# views.py (final) – No MachineInstallation creation in GetMachineDetails
from rest_framework import status, permissions, serializers, viewsets, generics
from rest_framework.authentication import TokenAuthentication
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import User as AuthUser
from django.core.cache import cache
from django.core.mail import send_mail
from django.db import connections, models
from django.contrib.contenttypes.models import ContentType
from django.db.models import Q
from django.conf import settings

from .models import (
    Company, Dealer, Employee, LoginRecord,
    MachineInstallation, InstallationPhoto, Task, AccountMaster, ticket, TicketCategory, Department
)
from .serializers import (
    CompanySerializer, DealerSerializer, EmployeeSerializer, TicketSerializer,
    TicketCategorySerializer, DepartmentSerializer,
    MachineInstallationSerializer, TaskSerializer, AccountMasterSerializer, UserRoleSerializer
)
from .utils import generate_otp, send_otp_email


# -------------------------------------------------------------------
# Helper – create dummy auth_user for DRF Token
# -------------------------------------------------------------------
def get_or_create_auth_user(email: str) -> AuthUser:
    user, _ = AuthUser.objects.get_or_create(
        username=email.lower(),
        defaults={
            "email": email.lower(),
            "password": make_password("Comptech@123"),
            "is_active": True,
        },
    )
    return user


# -------------------------------------------------------------------
# Company Registration & List
# -------------------------------------------------------------------
class RegisterCompany(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
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
            print(f"Error sending email to {company.email}: {exc}")
            return Response({"message": msg, "error": str(exc), "data": serializer.data}, status=status.HTTP_201_CREATED)
        return Response({"message": msg, "data": serializer.data}, status=status.HTTP_201_CREATED)

class CompanyListView(generics.ListAPIView):
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    permission_classes = [AllowAny]


# -------------------------------------------------------------------
# Dealer CRUD
# -------------------------------------------------------------------
class DealerListView(generics.ListCreateAPIView):
    
    queryset = Dealer.objects.all()
    serializer_class = DealerSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [AllowAny()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        email = serializer.validated_data["email"]
        is_direct = self.request.data.get("isDirect", False)
        if not is_direct and not cache.get(f"verified_otp_{email}"):
            raise serializers.ValidationError("Please verify OTP first.")
        dealer = serializer.save()
        if not is_direct:
            cache.delete(f"verified_otp_{email}")
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

class DealerDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Dealer.objects.all()
    serializer_class = DealerSerializer
    permission_classes = [IsAuthenticated]


# -------------------------------------------------------------------
# OTP Views
# -------------------------------------------------------------------
class SendOTPView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        email = request.data.get("email")
        if not email:
            return Response({"message": "E-mail required."}, status=status.HTTP_400_BAD_REQUEST)
        otp = generate_otp()
        send_otp_email(email, otp)
        cache.set(f"otp_{email}", otp, timeout=300)
        return Response({"message": f"OTP sent to {email}."})

class VerifyOTPView(APIView):
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
        cache.set(f"verified_otp_{email}", True, timeout=600)
        cache.delete(f"otp_{email}")
        return Response({"message": "OTP verified."})


# -------------------------------------------------------------------
# Unified Login (Employee → Dealer → Company)
# -------------------------------------------------------------------
class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def _issue_token(self, email: str) -> str:
        token, _ = Token.objects.get_or_create(user=get_or_create_auth_user(email))
        return token.key

    def post(self, request):
        email = (request.data.get("email") or "").lower().strip()
        password = request.data.get("password") or ""

        # Employee
        emp = Employee.objects.filter(email=email).first()
        if emp:
            if check_password(password, emp.password):
                # Determine company name
                if emp.company:
                    company_name = emp.company.name
                elif emp.dealer and emp.dealer.company:
                    company_name = emp.dealer.company.name
                else:
                    company_name = None

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
                    "company_name": company_name,
                }, status=status.HTTP_200_OK)
            LoginRecord.objects.create(email=email, user_type="employee", success=False)
            return Response({"message": "Invalid password"}, status=status.HTTP_401_UNAUTHORIZED)

        # Dealer
        dealer = Dealer.objects.filter(email=email).first()
        if dealer:
            if check_password(password, dealer.password):
                company_name = dealer.company.name if dealer.company else None
                LoginRecord.objects.create(email=email, user_type="dealer", success=True)
                return Response({
                    "message": "Login successful",
                    "token": self._issue_token(email),
                    "user_type": "dealer",
                    "dealer_id": dealer.id,
                    "company_id": dealer.company_id,
                    "name": dealer.name,
                    "role": "DEALER_ADMIN",
                    "company_name": company_name,
                }, status=status.HTTP_200_OK)
            LoginRecord.objects.create(email=email, user_type="dealer", success=False)
            return Response({"message": "Invalid password"}, status=status.HTTP_401_UNAUTHORIZED)

        # Company
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
                    "company_name": company.name,
                }, status=status.HTTP_200_OK)
            LoginRecord.objects.create(email=email, user_type="company", success=False)
            return Response({"message": "Invalid password"}, status=status.HTTP_401_UNAUTHORIZED)

        return Response({"message": "User not found."}, status=status.HTTP_404_NOT_FOUND)


# -------------------------------------------------------------------
# Employee CRUD
# -------------------------------------------------------------------
class RegisterEmployee(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        employee_qs = Employee.objects.all()
        current_employee = Employee.objects.filter(email=user.email).first()
        if current_employee:
            if current_employee.role == 'APPLICATION_ADMIN':
                pass
            elif current_employee.role in ['COMPANY_ADMIN', 'COMPANY_EMPLOYEE']:
                employee_qs = employee_qs.filter(company_id=current_employee.company_id)
            elif current_employee.role in ['DEALER_ADMIN', 'DEALER_EMPLOYEE']:
                employee_qs = employee_qs.filter(dealer_id=current_employee.dealer_id)
            else:
                return Response({"message": "Unauthorized role."}, status=status.HTTP_403_FORBIDDEN)
        else:
            company_user = Company.objects.filter(email=user.email).first()
            dealer_user = Dealer.objects.filter(email=user.email).first()
            if company_user:
                employee_qs = employee_qs.filter(company=company_user)
            elif dealer_user:
                employee_qs = employee_qs.filter(dealer=dealer_user)
            else:
                return Response({"message": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)
        return Response(EmployeeSerializer(employee_qs, many=True).data)

    def post(self, request):
        email = request.data.get("email")
        if Employee.objects.filter(email=email).exists():
            return Response({"message": "Employee already exists."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = EmployeeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        emp = serializer.save()
        return Response({"message": "Employee registered.", **EmployeeSerializer(emp).data}, status=status.HTTP_201_CREATED)

class EmployeeDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated]


# -------------------------------------------------------------------
# Dealer Count Helper
# -------------------------------------------------------------------
class DealerCountView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    def get(self, request):
        company_id = request.query_params.get("company_id")
        count = Dealer.objects.filter(company_id=company_id).count() if company_id else Dealer.objects.count()
        return Response({"dealer_count": count})


# -------------------------------------------------------------------
# Machine Installation Views
# -------------------------------------------------------------------
class MachineInstallationListView(generics.ListAPIView):
    serializer_class = MachineInstallationSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = MachineInstallation.objects.all().order_by("-created_at")
        company_id = self.request.query_params.get("company_id")
        dealer_id = self.request.query_params.get("dealer_id")
        user = self.request.user
        employee = Employee.objects.filter(email=user.email).first()
        if employee:
            if employee.role == "APPLICATION_ADMIN":
                pass
            elif employee.role in ["COMPANY_ADMIN", "COMPANY_EMPLOYEE"]:
                qs = qs.filter(company=employee.company)
            elif employee.role in ["DEALER_ADMIN", "DEALER_EMPLOYEE"]:
                qs = qs.filter(dealer=employee.dealer)
            else:
                return MachineInstallation.objects.none()
        elif Dealer.objects.filter(email=user.email).exists():
            dealer = Dealer.objects.get(email=user.email)
            qs = qs.filter(dealer=dealer)
        elif Company.objects.filter(email=user.email).exists():
            company = Company.objects.get(email=user.email)
            qs = qs.filter(company=company)
        else:
            return MachineInstallation.objects.none()
        if company_id:
            qs = qs.filter(company_id=company_id)
        if dealer_id:
            qs = qs.filter(dealer_id=dealer_id)
        return qs

class MachineInstallationDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = MachineInstallation.objects.all()
    serializer_class = MachineInstallationSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'pk'

@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
@permission_classes([IsAuthenticated])
def create_machine_installation(request):
    serializer = MachineInstallationSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data, status=status.HTTP_201_CREATED)


# -------------------------------------------------------------------
# Task Management
# -------------------------------------------------------------------
class IsAppAdminOrCompanyAdminForWrite(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        if not request.user.is_authenticated:
            return False

        try:
            employee = Employee.objects.get(email=request.user.email)
            if employee.role in ['APPLICATION_ADMIN', 'COMPANY_ADMIN']:
                return True
        except Employee.DoesNotExist:
            pass

        try:
            company = Company.objects.get(email=request.user.email)
            return True
        except Company.DoesNotExist:
            pass

        return False

class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsAppAdminOrCompanyAdminForWrite]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Task.objects.none()
        user_email = user.email
        employee = Employee.objects.filter(email=user_email).first()
        if employee:
            if employee.role == "APPLICATION_ADMIN":
                return Task.objects.all()
            elif employee.role == "COMPANY_ADMIN":
                return Task.objects.filter(
                    Q(assigner=employee.company) |
                    Q(assignee__company=employee.company)
                ).distinct()
            elif employee.role == "COMPANY_EMPLOYEE":
                return Task.objects.filter(assignee=employee)
            return Task.objects.none()
        company = Company.objects.filter(email=user_email).first()
        if company:
            return Task.objects.filter(assigner=company)
        return Task.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        employee = Employee.objects.filter(email=user.email).first()
        company = None

        if employee:
            company = employee.company
        else:
            company = Company.objects.filter(email=user.email).first()

        if company is None:
            serializer.save()
        else:
            serializer.save(
                assigner=company,
                assignee=serializer.validated_data.get("assignee")
            )

class EmployeeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = EmployeeSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if not user.is_authenticated:
            return Employee.objects.none()

        employee = Employee.objects.filter(email=user.email).first()
        if employee and employee.role == "APPLICATION_ADMIN":
            return Employee.objects.filter(role="COMPANY_EMPLOYEE")

        company = Company.objects.filter(email=user.email).first()
        if company:
            return Employee.objects.filter(company=company, role="COMPANY_EMPLOYEE")

        if employee and employee.role == "COMPANY_ADMIN":
            return Employee.objects.filter(company=employee.company, role="COMPANY_EMPLOYEE")

        return Employee.objects.none()


# -------------------------------------------------------------------
# Utility endpoints
# -------------------------------------------------------------------
@api_view(["GET"])
@permission_classes([AllowAny])
def check_serial_unique(request):
    serial = request.query_params.get("serial", "").strip()
    exists = MachineInstallation.objects.filter(serial_number__iexact=serial).exists()
    return Response({"isUnique": not exists})

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def check_batch_unique(request):
    batch = request.query_params.get("batch", "").strip()
    if not batch:
        return Response({"error": "Batch number is required."}, status=status.HTTP_400_BAD_REQUEST)
    exists = MachineInstallation.objects.filter(batch_number__iexact=batch).exists()
    return Response({"isUnique": not exists})

class GetDealerDataByBatch(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        batch_no = request.query_params.get("batch", "").strip()
        if not batch_no:
            return Response({"error": "Batch number is required."}, status=status.HTTP_400_BAD_REQUEST)
        user = request.user
        role = None
        user_gst = None
        current_employee = Employee.objects.filter(email=getattr(user, 'email', None)).first()
        if current_employee:
            role = current_employee.role.lower()
            if current_employee.dealer:
                user_gst = current_employee.dealer.gst_no
            elif current_employee.company:
                user_gst = current_employee.company.gst_no
        else:
            dealer_user = Dealer.objects.filter(email=getattr(user, 'email', None)).first()
            if dealer_user:
                role = 'dealer_admin'
                user_gst = dealer_user.gst_no
            else:
                company_user = Company.objects.filter(email=getattr(user, 'email', None)).first()
                if company_user:
                    role = 'company_admin'
                    user_gst = company_user.gst_no
                else:
                    return Response({"error": "Unable to determine user role or associated entity."}, status=status.HTTP_403_FORBIDDEN)
        try:
            with connections['munim006_db'].cursor() as cursor:
                query = """
                    SELECT
                        itm.itemcode as item_code,
                        itm.ItemName AS item_name,
                        sibd.BatchNo AS batch_number,
                        a.DocumentNo AS invoice_number,
                        a.DocumentDate AS purchase_date,
                        am.AccountName AS party_name,
                        am.GSTNo AS gst_no
                    FROM SalesInvoice AS a
                    LEFT JOIN SalesInvoiceDetails AS b ON a.SalesInvoiceId = b.SalesInvoiceId
                    LEFT JOIN ItemMaster AS itm ON itm.ItemMasterId = b.ItemMasterId
                    LEFT JOIN SalesInvoiceBatchDetails AS sibd ON sibd.SalesInvoiceDetailsId = b.SalesInvoiceDetailsId
                    LEFT JOIN AccountMaster AS am ON am.AccountMasterId = a.PartyAccountMasterId
                    where 
                    itm.ItemGroupMasterId in (2,3,5,8,10,11,12,13,14,16,29,20077,40103,40105,40107) 
                    and  sibd.BatchNo = %s
                """
                cursor.execute(query, [batch_no])
                row = cursor.fetchone()
            if not row:
                return Response({"error": "Machine not found for this batch number in the external database."}, status=status.HTTP_404_NOT_FOUND)
            item_code, item_name, batch_number, invoice_number, purchase_date, party_name, party_gst = row
            if role in ['dealer_admin', 'dealer_employee']:
                if not user_gst:
                    return Response({"error": "Your GST number is missing in your profile. Please update your profile or contact support."}, status=status.HTTP_400_BAD_REQUEST)
                if user_gst.strip().upper() != (party_gst or '').strip().upper():
                    return Response({"error": "You are not authorized to view this item's details. GST mismatch."}, status=status.HTTP_403_FORBIDDEN)
            return Response({
                "item_name": item_name,
                "item_code": item_code,
                "batch_number": batch_number,
                "invoice_number": invoice_number,
                "purchase_date": purchase_date,
                "party_name": party_name,
                "gst_no": party_gst,
            }, status=status.HTTP_200_OK)
        except Exception as e:
            print(f"[ERROR] Machine fetch failed from munim006_db: {e}")
            return Response({"error": f"Internal server error while fetching external data: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_machine_details_by_batch(request):
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
    permission_classes = [AllowAny]

    def get(self, request):
        gst_no = request.query_params.get('gst_no', None)
        if not gst_no:
            return Response({"error": "GST number is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            account_data = AccountMaster.objects.using('munim006_db').get(gstno=gst_no)
            serializer = AccountMasterSerializer(account_data)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except AccountMaster.DoesNotExist:
            return Response({"error": "No data found for this GST number in the external database."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"Error fetching party details by GST from munim006_db: {e}")
            return Response({"error": f"Internal server error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UserRoleViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        all_users = list(Employee.objects.all()) + list(Dealer.objects.all()) + list(Company.objects.all())
        serializer = UserRoleSerializer(all_users, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class TicketCategoryViewSet(viewsets.ModelViewSet):
    queryset = TicketCategory.objects.all().order_by('name')
    serializer_class = TicketCategorySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class TicketViewSet(viewsets.ModelViewSet):
    queryset = ticket.objects.all().select_related(
        'category', 'machine_installation',
        'created_by_content_type', 'assigned_to_content_type',
    ).order_by('-created_at')

    serializer_class = TicketSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        user = self.request.user
        email = user.email

        obj = None
        user_role = None
        user_gst = None

        # ================= GET USER =================
        if Employee.objects.filter(email=email).exists():
            obj = Employee.objects.get(email=email)
            user_role = obj.role
            if user_role == "DEALER_EMPLOYEE" and obj.dealer:
                user_gst = obj.dealer.gst_no

        elif Dealer.objects.filter(email=email).exists():
            obj = Dealer.objects.get(email=email)
            user_role = "DEALER_ADMIN"
            user_gst = obj.gst_no

        elif Company.objects.filter(email=email).exists():
            obj = Company.objects.get(email=email)
            user_role = "COMPANY_ADMIN"

        # ================= GST VALIDATION (only if machine_installation is provided) =================
        if user_role in ["DEALER_ADMIN", "DEALER_EMPLOYEE"]:
            machine = serializer.validated_data.get("machine_installation")
            if machine:
                machine_gst = getattr(machine, "gst_no", None)
                if not machine_gst:
                    raise serializers.ValidationError({"gst": "Machine GST not found."})
                if not user_gst:
                    raise serializers.ValidationError({"gst": "Your GST number is not available."})
                if user_gst.strip().upper() != machine_gst.strip().upper():
                    raise serializers.ValidationError({"gst": "GST mismatch. You are not allowed to create this ticket."})

        # ================= SAVE =================
        if obj:
            serializer.save(
                created_by_content_type=ContentType.objects.get_for_model(obj),
                created_by_object_id=obj.pk
            )
        else:
            serializer.save()

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()

        if user.is_superuser:
            return qs

        email = user.email

        if Employee.objects.filter(email=email).exists():
            emp = Employee.objects.get(email=email)
            return qs.filter(assigned_to_object_id=emp.pk)

        elif Dealer.objects.filter(email=email).exists():
            dealer = Dealer.objects.get(email=email)
            return qs.filter(created_by_object_id=dealer.pk)

        elif Company.objects.filter(email=email).exists():
            company = Company.objects.get(email=email)
            return qs.filter(created_by_object_id=company.pk)

        return qs.none()


@api_view(["GET"])
def get_departments(request):
    departments = Department.objects.filter(is_active=True)
    serializer = DepartmentSerializer(departments, many=True)
    return Response(serializer.data)


@api_view(["GET"])
def get_tickets(request):
    employee = request.user.employee
    if not employee.Department or employee.Department.department_name != "Service":
        return Response(
            {"error": "You are not allowed to access tickets."},
            status=status.HTTP_403_FORBIDDEN
        )
    tickets = ticket.objects.all()
    serializer = TicketSerializer(tickets, many=True)
    return Response(serializer.data)


from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import connections
from .models import Company, Dealer, Employee, MachineInstallation


class GetMachineDetails(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        batch = request.query_params.get('batch', '').strip()
        vin = request.query_params.get('vin', '').strip().upper()
        user = request.user
        email = user.email

        # ================= GET COMPANY =================
        company = None
        if Employee.objects.filter(email=email).exists():
            emp = Employee.objects.get(email=email)
            company = emp.company or (emp.dealer.company if emp.dealer else None)

        elif Dealer.objects.filter(email=email).exists():
            dealer = Dealer.objects.get(email=email)
            company = dealer.company

        elif Company.objects.filter(email=email).exists():
            company = Company.objects.get(email=email)

        if not company:
            return Response({"error": "Company not found for user."}, status=403)

        company_name = company.name.lower()

        # ================= ROUTING =================
        if "comptech equipments limited" in company_name:
            if not batch:
                return Response({"error": "Batch number required."}, status=400)
            return self._fetch_equipment(batch, company)

        elif "comptech motocorp private limited" in company_name:
            if not vin:
                return Response({"error": "VIN number required."}, status=400)
            return self._fetch_motocorp(vin, company)

        # fallback
        else:
            if batch:
                return self._fetch_equipment(batch, company)
            elif vin:
                return self._fetch_motocorp(vin, company)

            return Response({"error": "Provide batch or VIN."}, status=400)

    # =========================================================
    # EQUIPMENT (Batch based) – only returns data, no DB save
    # =========================================================
    def _fetch_equipment(self, batch, company):
        try:
            with connections['munim006_db'].cursor() as cursor:
                query = """
                    SELECT
                        itm.ItemCode,
                        b.Remarks,
                        itm.ItemName,
                        sibd.BatchNo,
                        a.DocumentNo,
                        a.DocumentDate,
                        am.AccountName,
                        am.GSTNo
                    FROM SalesInvoice a
                    LEFT JOIN SalesInvoiceDetails b ON a.SalesInvoiceId = b.SalesInvoiceId
                    LEFT JOIN ItemMaster itm ON itm.ItemMasterId = b.ItemMasterId
                    LEFT JOIN SalesInvoiceBatchDetails sibd ON sibd.SalesInvoiceDetailsId = b.SalesInvoiceDetailsId
                    LEFT JOIN AccountMaster am ON am.AccountMasterId = a.PartyAccountMasterId
                    WHERE itm.ItemGroupMasterId IN (2,3,5,8,10,11,12,13,14,16,29,20077,40103,40105,40107)
                      AND sibd.BatchNo = %s
                """
                cursor.execute(query, [batch])
                row = cursor.fetchone()

            if not row:
                return Response({"error": "Batch not found."}, status=404)

            item_code, remarks, item_name, batch_no, invoice_no, invoice_date, party_name, gst_no = row

            # 🔥 NO DATABASE SAVE – just return the data
            return Response({
                "item_code": item_code,
                "remarks": remarks,
                "item_name": item_name,
                "batch_number": batch_no,
                "invoice_number": invoice_no,
                "purchase_date": invoice_date,
                "party_name": party_name,
                "gst_no": gst_no,
            })

        except Exception as e:
            return Response({"error": str(e)}, status=500)

    # =========================================================
    # MOTOCORP (VIN based) – only returns data
    # =========================================================
    def _fetch_motocorp(self, vin, company):
        try:
            with connections['munim010_db'].cursor() as cursor:

                query = """
                SELECT * FROM (

                    -- QUERY 1
                    SELECT
                        itm.ItemCode,
                        itm.ItemName,
                        si.DocumentNo,
                        si.DocumentDate,
                        am.AccountName,
                        am.GSTNo,
                        COALESCE(
                            NULLIF(NULLIF(udf.UDF_VinNo_2116,'0'),''),
                            NULLIF(NULLIF(udf.UDF_Vinnumber_2116,'0'),'')
                        ) AS VinNo

                    FROM SalesInvoiceBatchDetails sibd
                    INNER JOIN SalesInvoiceDetails sid ON sid.SalesInvoiceDetailsId = sibd.SalesInvoiceDetailsId
                    INNER JOIN SalesInvoice si ON si.SalesInvoiceId = sid.SalesInvoiceId
                    INNER JOIN ItemMaster itm ON itm.ItemMasterId = sid.ItemMasterId
                    INNER JOIN AccountMaster am ON am.AccountMasterId = si.PartyAccountMasterId
                    LEFT JOIN DispatchDetails disd ON disd.DispatchDetailsId = sid.ReferenceId
                    LEFT JOIN DispatchBatchDetails disb ON disb.DispatchDetailsId = disd.DispatchDetailsId AND disb.BatchNo = sibd.BatchNo
                    LEFT JOIN DispatchBatchDetailsUDF udf ON udf.DispatchBatchDetailsId = disb.DispatchBatchDetailsId

                    WHERE itm.ItemGroupMasterId IN (110110,110108,110107,110102,110103,110115)

                    UNION

                    -- QUERY 2
                    SELECT
                        itm.ItemCode,
                        itm.ItemName,
                        si.DocumentNo,
                        si.DocumentDate,
                        am.AccountName,
                        am.GSTNo,
                        COALESCE(
                            NULLIF(NULLIF(udf.UDF_VinNo_2116,'0'),''),
                            NULLIF(NULLIF(udf.UDF_Vinnumber_2116,'0'),'')
                        ) AS VinNo

                    FROM DispatchBatchDetails disb
                    INNER JOIN DispatchDetails disd ON disd.DispatchDetailsId = disb.DispatchDetailsId
                    INNER JOIN Dispatch dis ON dis.DispatchId = disd.DispatchId
                    LEFT JOIN SalesInvoiceDetails sid ON sid.ReferenceId = disd.DispatchDetailsId
                    LEFT JOIN SalesInvoice si ON si.SalesInvoiceId = sid.SalesInvoiceId
                    LEFT JOIN AccountMaster am ON am.AccountMasterId = si.PartyAccountMasterId
                    INNER JOIN ItemMaster itm ON itm.ItemMasterId = sid.ItemMasterId
                    LEFT JOIN DispatchBatchDetailsUDF udf ON udf.DispatchBatchDetailsId = disb.DispatchBatchDetailsId

                    WHERE itm.ItemGroupMasterId IN (110110,110108,110107,110102,110103,110115)

                ) AS FinalData
                WHERE VinNo = %s
                """

                cursor.execute(query, [vin])
                row = cursor.fetchone()

            if not row:
                return Response({"error": "VIN not found."}, status=404)

            item_code, item_name, invoice_no, invoice_date, party_name, gst_no, vin_no = row

            return Response({
                "item_code": item_code,
                "item_name": item_name,
                "invoice_number": invoice_no,
                "purchase_date": invoice_date,
                "vin": vin_no,
                "party_name": party_name,
                "gst_no": gst_no,
            })

        except Exception as e:
            return Response({"error": str(e)}, status=500)