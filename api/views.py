from rest_framework import status, permissions, serializers, viewsets
from rest_framework.authentication import TokenAuthentication
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.generics import ListAPIView, ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import User as AuthUser
from django.core.cache import cache
from django.core.mail import send_mail
from django.shortcuts import get_object_or_404
from django.db import connections
from django.conf import settings

from .models import (
    Company,
    Dealer,
    Employee,
    LoginRecord,
    MachineInstallation,
    InstallationPhoto,
    Task,
    AccountMaster # Ensure AccountMaster is imported for the external DB interaction
)
from .serializers import (
    CompanySerializer,
    DealerSerializer,
    EmployeeSerializer,
    MachineInstallationSerializer,
    TaskSerializer,
    AccountMasterSerializer, # <--- IMPORT AccountMasterSerializer here
)
from .utils import generate_otp, send_otp_email


# Helper – create dummy auth_user for DRF Token
def get_or_create_auth_user(email: str) -> AuthUser:
    """
    Retrieves or creates a Django AuthUser for token generation.
    Password for newly created users is a placeholder as they won't log in directly via this user.
    """
    user, _ = AuthUser.objects.get_or_create(
        username=email.lower(),
        defaults={
            "email": email.lower(),
            "password": make_password("Comptech@123"),
            "is_active": True,
        },
    )
    return user


# --- Company Registration ---
class RegisterCompany(APIView):
    """
    Handles company registration (POST).
    """
    permission_classes = [AllowAny] # Allow POST without authentication

    def post(self, request):
        """Registers a new company."""
        email = request.data.get("email")
        if Company.objects.filter(email=email).exists():
            return Response({"message": "A company with this e-mail already exists."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = CompanySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        company = serializer.save()

        msg = "Company registered."
        try:
            send_mail(
                subject="Welcome to Comptech!",
                message=f"Dear {company.name},\n\nWelcome aboard!",
                from_email=settings.EMAIL_HOST_USER,
                recipient_list=[company.email],
                fail_silently=False,
            )
            msg += " Welcome e-mail sent."
        except Exception as exc:
            msg += " (Welcome e-mail failed)."
            print(f"Error sending email to {company.email}: {exc}")
            # Still return 201 as the company registration itself was successful
            return Response({"message": msg, "error": str(exc), "data": serializer.data}, status=status.HTTP_201_CREATED)

        return Response({"message": msg, "data": serializer.data}, status=status.HTTP_201_CREATED)


class CompanyListView(ListAPIView):
    """
    Returns a list of all registered companies.
    Accessible to anyone (AllowAny). If authentication is required, change permission_classes.
    """
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    permission_classes = [AllowAny] # Change to [IsAuthenticated] if desired


# --- Dealer CRUD ---
class DealerListView(ListCreateAPIView):
    """
    Handles listing and creation of dealers.
    POST requires OTP verification unless 'isDirect' flag is set.
    """
    queryset = Dealer.objects.all()
    serializer_class = DealerSerializer

    def get_permissions(self):
        """
        Sets permissions: AllowAny for POST (registration), IsAuthenticated for GET (listing).
        """
        if self.request.method == "POST":
            return [AllowAny()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        """
        Performs dealer creation, including OTP verification check.
        """
        email = serializer.validated_data["email"]
        is_direct = self.request.data.get("isDirect", False) # Flag from React UI

        if not is_direct and not cache.get(f"verified_otp_{email}"):
            raise serializers.ValidationError("Please verify OTP first.")

        dealer = serializer.save()

        if not is_direct:
            cache.delete(f"verified_otp_{email}") # Clear OTP verification status after successful registration

        try:
            send_mail(
                subject="Welcome as a Dealer to Comptech!",
                message=f"Dear {dealer.name},\n\nWelcome aboard!",
                from_email=settings.EMAIL_HOST_USER,
                recipient_list=[dealer.email],
                fail_silently=False,
            )
        except Exception as exc:
            print(f"Error sending dealer welcome email to {dealer.email}: {exc}")


class DealerDetailView(RetrieveUpdateDestroyAPIView):
    """
    Handles retrieving, updating, and deleting a specific dealer.
    Requires authentication.
    """
    queryset = Dealer.objects.all()
    serializer_class = DealerSerializer
    permission_classes = [IsAuthenticated]


# --- OTP Views ---
class SendOTPView(APIView):
    """Sends a one-time password (OTP) to the provided email."""
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        if not email:
            return Response({"message": "E-mail required."}, status=status.HTTP_400_BAD_REQUEST)

        otp = generate_otp()
        send_otp_email(email, otp)
        cache.set(f"otp_{email}", otp, timeout=300)   # OTP valid for 5 minutes
        return Response({"message": f"OTP sent to {email}."})


class VerifyOTPView(APIView):
    """Verifies the provided OTP against the stored one."""
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        otp_input = request.data.get("otp")
        real_otp = cache.get(f"otp_{email}")

        if not (email and otp_input):
            return Response({"message": "E-mail & OTP required."}, status=status.HTTP_400_BAD_REQUEST)
        if not real_otp:
            return Response({"message": "OTP expired / not found."}, status=status.HTTP_400_BAD_REQUEST)
        if otp_input != real_otp:
            return Response({"message": "Invalid OTP."}, status=status.HTTP_400_BAD_REQUEST)

        cache.set(f"verified_otp_{email}", True, timeout=600) # OTP verification status valid for 10 minutes
        cache.delete(f"otp_{email}") # Delete the OTP after successful verification
        return Response({"message": "OTP verified."})


# --- Unified Login (Employee → Dealer → Company) ---
class LoginView(APIView):
    """
    Handles login for Employee, Dealer, and Company users.
    Attempts authentication in this specific order.
    """
    permission_classes = [permissions.AllowAny]

    def _issue_token(self, email: str) -> str:
        """Helper to get or create a DRF authentication token for a given email."""
        token, _ = Token.objects.get_or_create(user=get_or_create_auth_user(email))
        return token.key

    def post(self, request):
        email = (request.data.get("email") or "").lower().strip()
        password = request.data.get("password") or ""

        # 1. Try Employee Login
        emp = Employee.objects.filter(email=email).first()
        if emp:
            if check_password(password, emp.password):
                LoginRecord.objects.create(email=email, user_type="employee", success=True)
                return Response({
                    "message": "Login successful",
                    "token": self._issue_token(email),
                    "user_type": "employee",
                    "employee_id": emp.id,
                    "name": emp.name,
                    "role": emp.role,
                    "company_id": emp.company_id,
                    "dealer_id": emp.dealer_id,
                }, status=status.HTTP_200_OK)
            LoginRecord.objects.create(email=email, user_type="employee", success=False)
            return Response({"message": "Invalid password"}, status=status.HTTP_401_UNAUTHORIZED)

        # 2. Try Dealer Login
        dealer = Dealer.objects.filter(email=email).first()
        if dealer:
            if check_password(password, dealer.password):
                LoginRecord.objects.create(email=email, user_type="dealer", success=True)
                return Response({
                    "message": "Login successful",
                    "token": self._issue_token(email),
                    "user_type": "dealer",
                    "dealer_id": dealer.id,
                    "company_id": dealer.company_id,
                    "name": dealer.name,
                    "role": "DEALER_ADMIN",
                }, status=status.HTTP_200_OK)
            LoginRecord.objects.create(email=email, user_type="dealer", success=False)
            return Response({"message": "Invalid password"}, status=status.HTTP_401_UNAUTHORIZED)

        # 3. Try Company Login
        company = Company.objects.filter(email=email).first()
        if company:
            if check_password(password, company.password):
                LoginRecord.objects.create(email=email, user_type="company", success=True)
                return Response({
                    "message": "Login successful",
                    "token": self._issue_token(email),
                    "user_type": "company",
                    "company_id": company.id,
                    "name": company.name,
                    "role": "COMPANY_ADMIN",
                }, status=status.HTTP_200_OK)
            LoginRecord.objects.create(email=email, user_type="company", success=False)
            return Response({"message": "Invalid password"}, status=status.HTTP_401_UNAUTHORIZED)

        # If no user found
        return Response({"message": "User not found."}, status=status.HTTP_404_NOT_FOUND)


# --- Employee CRUD ---
class RegisterEmployee(APIView):
    """
    Handles employee registration (POST) and listing (GET).
    Requires authentication to register or list employees.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Returns a list of employees filtered by the requesting user's company/dealer."""
        user = request.user
        employee_qs = Employee.objects.all()

        # Check if the authenticated user is an internal Employee model instance
        current_employee = None
        if hasattr(user, 'employee'): # Assuming you've set up a OneToOneField or similar if AuthUser links to Employee
            current_employee = user.employee
        else:
            # Fallback: Try to find employee by email if AuthUser doesn't have direct link
            current_employee = Employee.objects.filter(email=user.email).first()

        if current_employee:
            user_role = current_employee.role
            user_company_id = current_employee.company_id
            user_dealer_id = current_employee.dealer_id

            if user_role == 'APPLICATION_ADMIN':
                pass # Application admin can see all employees
            elif user_role in ['COMPANY_ADMIN', 'COMPANY_EMPLOYEE']:
                employee_qs = employee_qs.filter(company_id=user_company_id)
            elif user_role in ['DEALER_ADMIN', 'DEALER_EMPLOYEE']:
                employee_qs = employee_qs.filter(dealer_id=user_dealer_id)
            else:
                return Response({"message": "Unauthorized role to view employees."}, status=status.HTTP_403_FORBIDDEN)
        else:
            # If authenticated user is not an Employee, check if they are a Company or Dealer directly
            company_user = Company.objects.filter(email=user.email).first()
            dealer_user = Dealer.objects.filter(email=user.email).first()

            if company_user:
                employee_qs = employee_qs.filter(company=company_user)
            elif dealer_user:
                employee_qs = employee_qs.filter(dealer=dealer_user)
            else:
                return Response({"message": "Not authorized to view employees."}, status=status.HTTP_403_FORBIDDEN)
        
        return Response(EmployeeSerializer(employee_qs, many=True).data)

    def post(self, request):
        """Registers a new employee."""
        email = request.data.get("email")
        if Employee.objects.filter(email=email).exists():
            return Response({"message": "Employee with this e-mail already exists."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = EmployeeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        emp = serializer.save()
        return Response({"message": "Employee registered.", **EmployeeSerializer(emp).data}, status=status.HTTP_201_CREATED)


class EmployeeDetailView(RetrieveUpdateDestroyAPIView):
    """
    Handles retrieving, updating, and deleting a specific employee.
    Requires authentication.
    """
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated]


# --- Dealer Count Helper ---
class DealerCountView(APIView):
    """
    Returns the count of dealers, optionally filtered by company_id.
    Requires authentication.
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_id = request.query_params.get("company_id")
        count = Dealer.objects.filter(company_id=company_id).count() if company_id else Dealer.objects.count()
        return Response({"dealer_count": count})


# --- Machine Installation Views ---
class MachineInstallationListView(ListAPIView):
    """
    Handles listing of machine installations.
    Optionally filters by company_id or dealer_id.
    Requires authentication.
    """
    serializer_class = MachineInstallationSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Returns the queryset for machine installations, filtered by query parameters and user role.
        """
        qs = MachineInstallation.objects.all().order_by("-created_at")

        company_id_param = self.request.query_params.get("company_id")
        dealer_id_param = self.request.query_params.get("dealer_id")

        user_obj = None
        # Try to get the associated Employee, Dealer, or Company object for the authenticated user
        if hasattr(self.request.user, 'employee'):
            user_obj = self.request.user.employee
        elif hasattr(self.request.user, 'dealer'): # This assumes AuthUser has a 'dealer' OneToOne or reverse relation
            user_obj = self.request.user.dealer
        elif hasattr(self.request.user, 'company'): # This assumes AuthUser has a 'company' OneToOne or reverse relation
            user_obj = self.request.user.company
        else: # Fallback to looking up by email in case of no direct relation
            user_obj = Employee.objects.filter(email=self.request.user.email).first()
            if not user_obj:
                user_obj = Dealer.objects.filter(email=self.request.user.email).first()
            if not user_obj:
                user_obj = Company.objects.filter(email=self.request.user.email).first()

        if not user_obj:
            return MachineInstallation.objects.none()

        # Determine the role based on the object type
        if isinstance(user_obj, Employee):
            user_role = user_obj.role
            if user_role == "APPLICATION_ADMIN":
                pass # No additional filtering for app admin
            elif user_role in ["COMPANY_ADMIN", "COMPANY_EMPLOYEE"]:
                qs = qs.filter(company_id=user_obj.company_id)
            elif user_role in ["DEALER_ADMIN", "DEALER_EMPLOYEE"]:
                qs = qs.filter(dealer_id=user_obj.dealer_id)
            else:
                return MachineInstallation.objects.none() # Unknown employee role
        elif isinstance(user_obj, Dealer):
            qs = qs.filter(dealer_id=user_obj.id)
        elif isinstance(user_obj, Company):
            qs = qs.filter(company_id=user_obj.id)
        else:
            return MachineInstallation.objects.none() # Unknown user type

        # Further filter by query params if provided and allowed by the user's scope
        if company_id_param:
            qs = qs.filter(company_id=company_id_param)
        if dealer_id_param:
            qs = qs.filter(dealer_id=dealer_id_param)

        return qs


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
@permission_classes([IsAuthenticated])
def create_machine_installation(request):
    """
    Creates a new machine installation record, including photo uploads.
    Requires authentication.
    """
    serializer = MachineInstallationSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data, status=status.HTTP_201_CREATED)


# --- Generic Task ViewSet ---
class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.all().order_by("-created_at")
    serializer_class = TaskSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

@api_view(["GET"])
@permission_classes([AllowAny])
def check_serial_unique(request):
    serial = request.query_params.get("serial", "").strip()
    exists = MachineInstallation.objects.filter(serial_number__iexact=serial).exists()
    return Response({"isUnique": not exists})

# --- Check Batch Number Uniqueness ---
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def check_batch_unique(request):
    """
    Checks if a given batch number already exists in MachineInstallation records.
    Requires authentication.
    """
    batch = request.query_params.get("batch", "").strip()
    if not batch:
        return Response({"error": "Batch number is required."}, status=status.HTTP_400_BAD_REQUEST)

    exists = MachineInstallation.objects.filter(batch_number__iexact=batch).exists()
    return Response({"isUnique": not exists}, status=status.HTTP_200_OK)


# --- Get Dealer Data by Batch (from Munim006 DB) ---
class GetDealerDataByBatch(APIView): # Renamed for clarity in URL and import
    permission_classes = [AllowAny]

    def get(self, request):
        batch_no = request.query_params.get("batch", "").strip()
        if not batch_no:
            return Response({"error": "Batch number is required."}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        role = None
        user_gst = None

        # Determine role and GST from internal DB
        # Refined user identification logic
        current_employee = Employee.objects.filter(email=user.email).first()
        if current_employee:
            role = current_employee.role.lower()
            if current_employee.dealer: # If an employee is linked to a dealer
                user_gst = current_employee.dealer.gst_no
            elif current_employee.company: # If an employee is linked to a company
                user_gst = current_employee.company.gst_no # You might want this for company-level checks
        else:
            dealer_user = Dealer.objects.filter(email=user.email).first()
            if dealer_user:
                role = 'dealer_admin'
                user_gst = dealer_user.gst_no
            else:
                company_user = Company.objects.filter(email=user.email).first()
                if company_user:
                    role = 'company_admin'
                    user_gst = company_user.gst_no # You might want this for company-level checks
                else:
                    return Response({"error": "Unable to determine user role or associated entity."}, status=status.HTTP_403_FORBIDDEN)


        # Get data from munim006
        try:
            with connections['munim006_db'].cursor() as cursor:
                query = """
                    SELECT
                        itm.ItemName AS item_name,
                        sibd.BatchNo AS batch_number,
                        a.DocumentNo AS invoice_number,
                        a.DocumentDate AS purchase_date,
                        am.AccountName AS party_name,
                        am.GSTNo AS gst_no
                        -- Add address and phone if they exist in AccountMaster table in MSSQL
                        , am.Address AS address_col
                        , am.Phone AS phone_col
                    FROM SalesInvoice AS a
                    LEFT JOIN SalesInvoiceDetails AS b ON a.SalesInvoiceId = b.SalesInvoiceId
                    LEFT JOIN ItemMaster AS itm ON itm.ItemMasterId = b.ItemMasterId
                    LEFT JOIN SalesInvoiceBatchDetails AS sibd ON sibd.SalesInvoiceDetailsId = b.SalesInvoiceDetailsId
                    LEFT JOIN AccountMaster AS am ON am.AccountMasterId = a.PartyAccountMasterId
                    WHERE sibd.BatchNo = %s
                """
                cursor.execute(query, [batch_no])
                # Fetch all rows (though likely only one for a unique batch number)
                # and get the first one if it exists
                row = cursor.fetchone()

            if not row:
                return Response({"error": "Machine not found for this batch number in the external database."}, status=status.HTTP_404_NOT_FOUND)

            # Map fetched columns to variables - ensure order matches query
            item_name, batch_number, invoice_number, purchase_date, party_name, party_gst, party_address, party_phone = row

            # GST validation only for dealer_admin and dealer_employee
            if role in ['dealer_admin', 'dealer_employee']:
                if not user_gst:
                    return Response({"error": "Your GST number is missing in your profile. Please update your profile or contact support."}, status=status.HTTP_400_BAD_REQUEST)
                if user_gst.strip().upper() != (party_gst or '').strip().upper():
                    return Response({"error": "You are not authorized to view this item's details. GST mismatch."}, status=status.HTTP_403_FORBIDDEN)

            return Response({
                "item_name": item_name,
                "batch_number": batch_number,
                "invoice_number": invoice_number,
                "purchase_date": purchase_date,
                "party_name": party_name,
                "gst_no": party_gst,
                "address": party_address, # Include address
                "phone": party_phone,     # Include phone
            }, status=status.HTTP_200_OK)

        except Exception as e:
            print(f"[ERROR] Machine fetch failed from munim006_db: {e}")
            return Response({"error": f"Internal server error while fetching external data: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_machine_details_by_batch(request):
    """
    Retrieves machine installation details from the internal database by batch number.
    Requires authentication.
    """
    batch_number = request.GET.get('batch', '').strip()
    if not batch_number:
        return Response({"error": "Batch number is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        machine = MachineInstallation.objects.get(batch_number=batch_number)
        serializer = MachineInstallationSerializer(machine)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except MachineInstallation.DoesNotExist:
        return Response({"error": "Machine with this batch number does not exist in the internal database."}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        print(f"[ERROR] Internal machine fetch failed: {e}")
        return Response({"error": f"Internal server error while fetching machine details: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GetPartyDetailsByGST(APIView):
    """
    Retrieves party details from munim006_db based on GST number.
    This is intended for fetching data for pre-filling forms.
    """
    permission_classes = [AllowAny] # Changed to IsAuthenticated as it's sensitive data

    def get(self, request):
        gst_no = request.query_params.get('gst_no', None)
        if not gst_no:
            return Response({"error": "GST number is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Fetching from munim006_db using the Django ORM with .using()
            account_data = AccountMaster.objects.using('munim006_db').get(gstno=gst_no)
            
            # Use the serializer to get the data, which respects the fields defined in AccountMasterSerializer
            serializer = AccountMasterSerializer(account_data)
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except AccountMaster.DoesNotExist:
            return Response({"error": "No data found for this GST number in the external database."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"Error fetching party details by GST from munim006_db: {e}")
            return Response({"error": f"Internal server error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)