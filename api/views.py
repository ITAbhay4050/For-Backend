"""
Comptech Equipment Ltd – Django REST views
Last updated 7 Jul 2025
────────────────────────────────────────────────────────────────────────────
✓ Unified LoginView (employee → dealer → company)
✓ Full CRUD for Company / Dealer / Employee
✓ OTP send / verify
✓ Machine‑installation upload (max 3 pics × 5 MB)
✓ DRF Token auth on protected routes
"""
from rest_framework import status, permissions

from datetime import timedelta
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes

from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import User as AuthUser
from django.core.cache import cache
from django.core.mail import send_mail
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.authentication import TokenAuthentication
from rest_framework.decorators import api_view, parser_classes
from rest_framework.generics import (
    ListAPIView,
    ListCreateAPIView,
    RetrieveUpdateDestroyAPIView,
)
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token

from .models import (
    Company,
    Dealer,
    Employee,
    LoginRecord,
    MachineInstallation,
    InstallationPhoto,
    Task,
)
from .serializers import (
    CompanySerializer,
    DealerSerializer,
    EmployeeSerializer,
    MachineInstallationSerializer,
    TaskSerializer,
)
from .utils import generate_otp, send_otp_email


# ────────────────────────────────────────────────────────────────
# Helper – create dummy *auth_user* for DRF Token
# ────────────────────────────────────────────────────────────────
def get_or_create_auth_user(email: str) -> AuthUser:
    """
    DRF TokenAuthentication expects a django.contrib.auth User.
    We generate a throw‑away user that uses the e‑mail as *username*.
    """
    user, _ = AuthUser.objects.get_or_create(
        username=email.lower(),
        defaults={
            "email": email.lower(),
            "password": make_password("Comptech@123"),  # never used
        },
    )
    return user


# ────────────────────────────────────────────────────────────────
# Company
# ────────────────────────────────────────────────────────────────
class RegisterCompany(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(CompanySerializer(Company.objects.all(), many=True).data)

    def post(self, request):
        email = request.data.get("email")
        if Company.objects.filter(email=email).exists():
            return Response(
                {"message": "A company with this e‑mail already exists."}, status=400
            )

        serializer = CompanySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.validated_data["password"] = make_password(
            serializer.validated_data["password"]
        )
        company = serializer.save()

        # best‑effort welcome mail
        try:
            send_mail(
                subject="Welcome to Comptech!",
                message=f"Dear {company.name},\n\nWelcome aboard!",
                from_email="it02comptech@gmail.com",
                recipient_list=[company.email],
                fail_silently=False,
            )
            msg = "Company registered & welcome e‑mail sent."
        except Exception as exc:
            msg = "Company registered (welcome e‑mail failed)."
            return Response(
                {"message": msg, "error": str(exc), "data": serializer.data}, status=201
            )

        return Response({"message": msg, "data": serializer.data}, status=201)


# ────────────────────────────────────────────────────────────────
# Dealer  (generic ListCreate + RUD view)
# ────────────────────────────────────────────────────────────────
class DealerListView(ListCreateAPIView):
    queryset = Dealer.objects.all()
    serializer_class = DealerSerializer

    def get_permissions(self):
        return [AllowAny()] if self.request.method == "POST" else [IsAuthenticated()]

    def perform_create(self, serializer):
        email = serializer.validated_data["email"]
        is_direct = self.request.data.get("isDirect", False)

        # OTP check (unless direct admin create)
        if not is_direct and not cache.get(f"verified_otp_{email}"):
            raise serializers.ValidationError("Please verify OTP first.")

        serializer.save(password=make_password(serializer.validated_data["password"]))

        if not is_direct:
            cache.delete(f"verified_otp_{email}")


class DealerDetailView(RetrieveUpdateDestroyAPIView):
    queryset = Dealer.objects.all()
    serializer_class = DealerSerializer
    permission_classes = [IsAuthenticated]


# ────────────────────────────────────────────────────────────────
# OTP
# ────────────────────────────────────────────────────────────────
class SendOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        if not email:
            return Response({"message": "E‑mail required."}, status=400)

        otp = generate_otp()
        send_otp_email(email, otp)
        cache.set(f"otp_{email}", otp, timeout=300)  # 5 min
        return Response({"message": f"OTP sent to {email}."})


class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        otp_input = request.data.get("otp")
        real_otp = cache.get(f"otp_{email}")

        if not (email and otp_input):
            return Response({"message": "E‑mail & OTP required."}, status=400)
        if not real_otp:
            return Response({"message": "OTP expired / not found."}, status=400)
        if otp_input != real_otp:
            return Response({"message": "Invalid OTP."}, status=400)

        cache.set(f"verified_otp_{email}", True, timeout=600)  # 10 min grace
        cache.delete(f"otp_{email}")
        return Response({"message": "OTP verified."})


# ────────────────────────────────────────────────────────────────
# Unified Login  (Employee → Dealer → Company)
# ────────────────────────────────────────────────────────────────
class LoginView(APIView):
    """
    Unified login flow (Employee → Dealer → Company).

    ⚠️  Employee passwords are stored **in plain text**.
        Dealer & Company passwords remain hashed.
    """
    permission_classes = [permissions.AllowAny]

    # --------------------------------------------------
    # Helper – issue / reuse DRF token
    # --------------------------------------------------
    def _issue_token(self, email: str) -> str:
        token, _ = Token.objects.get_or_create(user=get_or_create_auth_user(email))
        return token.key

    # --------------------------------------------------
    # POST /api/login/
    # --------------------------------------------------
    def post(self, request):
        email = (request.data.get("email") or "").lower().strip()
        password = request.data.get("password") or ""

        # 1️⃣ Employee login (plain‑text check)
        emp = Employee.objects.filter(email=email).first()
        if emp:
            if password == emp.password:                         # ← plain comparison
                LoginRecord.objects.create(email=email, user_type="employee", success=True)
                return Response(
                    {
                        "message": "Login successful",
                        "token": self._issue_token(email),
                        "user_type": "employee",
                        "employee_id": emp.id,
                        "name": emp.name,
                        "role": emp.role,
                        "company_id": emp.company_id,
                        "dealer_id": emp.dealer_id,
                    },
                    status=status.HTTP_200_OK,
                )
            LoginRecord.objects.create(email=email, user_type="employee", success=False)
            return Response({"message": "Invalid password"}, status=status.HTTP_401_UNAUTHORIZED)

        # 2️⃣ Dealer login (hashed)
        dealer = Dealer.objects.filter(email=email).first()
        if dealer:
            if check_password(password, dealer.password):
                LoginRecord.objects.create(email=email, user_type="dealer", success=True)
                return Response(
                    {
                        "message": "Login successful",
                        "token": self._issue_token(email),
                        "user_type": "dealer",
                        "dealer_id": dealer.id,
                        "company_id": dealer.company_id,
                        "name": dealer.name,
                        "role": "DEALER_ADMIN",
                    },
                    status=status.HTTP_200_OK,
                )
            LoginRecord.objects.create(email=email, user_type="dealer", success=False)
            return Response({"message": "Invalid password"}, status=status.HTTP_401_UNAUTHORIZED)

        # 3️⃣ Company login (hashed)
        company = Company.objects.filter(email=email).first()
        if company:
            if check_password(password, company.password):
                LoginRecord.objects.create(email=email, user_type="company", success=True)
                return Response(
                    {
                        "message": "Login successful",
                        "token": self._issue_token(email),
                        "user_type": "company",
                        "company_id": company.id,
                        "name": company.name,
                        "role": "COMPANY_ADMIN",
                    },
                    status=status.HTTP_200_OK,
                )
            LoginRecord.objects.create(email=email, user_type="company", success=False)
            return Response({"message": "Invalid password"}, status=status.HTTP_401_UNAUTHORIZED)

        # 4️⃣ No user found
        return Response({"message": "User not found"}, status=status.HTTP_404_NOT_FOUND)

# ────────────────────────────────────────────────────────────────
# Employee  (create via protected endpoint, detail RUD)
# ────────────────────────────────────────────────────────────────
class RegisterEmployee(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(EmployeeSerializer(Employee.objects.all(), many=True).data)

    def post(self, request):
        data = request.data.copy()
        email = data.get("email")
        role = data.get("role")

        if Employee.objects.filter(email=email).exists():
            return Response({"message": "Employee already exists."}, status=400)

        # ✅ Ensure company_id for company-related roles
        if role in ["COMPANY_EMPLOYEE", "COMPANY_ADMIN"]:
            if not data.get("company"):
                return Response({"message": "Company ID is required."}, status=400)

        # ✅ Ensure dealer_id & fetch company_id from dealer for dealer roles
        if role in ["DEALER_EMPLOYEE", "DEALER_ADMIN"]:
            dealer_id = data.get("dealer")
            if not dealer_id:
                return Response({"message": "Dealer ID is required."}, status=400)

            try:
                dealer = Dealer.objects.get(id=dealer_id)
                data["company"] = dealer.company_id  # Link dealer's company to employee
            except Dealer.DoesNotExist:
                return Response({"message": "Dealer not found."}, status=404)

        # ✅ Continue with normal registration
        serializer = EmployeeSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        emp = serializer.save()

        return Response(
            {"message": "Employee registered.", **EmployeeSerializer(emp).data},
            status=201,
        )


class EmployeeDetailView(RetrieveUpdateDestroyAPIView):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated]


# ────────────────────────────────────────────────────────────────
# Dealer‑count helper
# ────────────────────────────────────────────────────────────────
class DealerCountView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_id = request.query_params.get("company_id")
        count = (
            Dealer.objects.filter(company_id=company_id).count()
            if company_id
            else Dealer.objects.count()
        )
        return Response({"dealer_count": count})


# ────────────────────────────────────────────────────────────────
# Machine‑installation (list + create multipart)
# ────────────────────────────────────────────────────────────────
class MachineInstallationListView(ListAPIView):
    serializer_class = MachineInstallationSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = MachineInstallation.objects.all().order_by("-created_at")
        company_id = self.request.query_params.get("company_id")
        dealer_id = self.request.query_params.get("dealer_id")
        if company_id:
            qs = qs.filter(company_id=company_id)
        if dealer_id:
            qs = qs.filter(dealer_id=dealer_id)
        return qs


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
def create_machine_installation(request):
    """
    Multipart POST:  installation fields + photo_files[]
    """
    ser = MachineInstallationSerializer(data=request.data, context={"request": request})
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(ser.data, status=201)


# ────────────────────────────────────────────────────────────────
# Generic Task ViewSet
# ────────────────────────────────────────────────────────────────
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
