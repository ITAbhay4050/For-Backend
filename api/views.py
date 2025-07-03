# api/views.py
"""
Django REST views for Comptech Equipment LIMITED API.
Updated 2 July 2025: Full merged version including OTP flow, login, company/dealer registration,
task and machine installation support with DRF TokenAuthentication.
"""
from rest_framework.generics import ListAPIView
from rest_framework import serializers  
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import User as AuthUser
from django.core.cache import cache
from django.core.mail import send_mail
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.authentication import TokenAuthentication
from rest_framework.decorators import api_view, parser_classes
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from .models import MachineInstallation, InstallationPhoto

from .models import Company, Dealer, LoginRecord, Task
from .serializers import (
    CompanySerializer,
    DealerSerializer,
    MachineInstallationSerializer,
    TaskSerializer,
)
from .utils import generate_otp, send_otp_email

# ---------------------------------------------------------------------------
# Helper: Auth User (for DRF Token system)
# ---------------------------------------------------------------------------
def get_or_create_auth_user(email: str) -> AuthUser:
    user, _ = AuthUser.objects.get_or_create(
        username=email.lower(),
        defaults={"email": email.lower(), "password": make_password("Comptech@123")},
    )
    return user


# ---------------------------------------------------------------------------
# Company Registration
# ---------------------------------------------------------------------------
class RegisterCompany(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        companies = Company.objects.all()
        return Response(CompanySerializer(companies, many=True).data)

    def post(self, request):
        email = request.data.get("email")
        if Company.objects.filter(email=email).exists():
            return Response({"message": "A company with this email already exists."}, status=400)

        serializer = CompanySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        serializer.validated_data["password"] = make_password(serializer.validated_data["password"])
        company = serializer.save()

        try:
            send_mail(
                subject="Welcome to Comptech Equipment LIMITED!",
                message=f"Dear {company.name},\n\nWelcome aboard!",
                from_email="it02comptech@gmail.com",
                recipient_list=[company.email],
                fail_silently=False,
            )
            msg = "Company registered successfully and welcome email sent!"
        except Exception as exc:
            msg = "Company registered, but welcome email failed."
            return Response({"message": msg, "error": str(exc), "data": serializer.data}, status=201)

        return Response({"message": msg, "data": serializer.data}, status=201)


# ---------------------------------------------------------------------------
# Dealer Registration - ListCreate (Generic View)
# ---------------------------------------------------------------------------
class DealerListView(ListCreateAPIView):
    queryset = Dealer.objects.all()
    serializer_class = DealerSerializer

    def get_permissions(self):
        return [AllowAny()] if self.request.method.lower() == "post" else [IsAuthenticated()]

def perform_create(self, serializer):
    email = serializer.validated_data["email"]
    is_direct = self.request.data.get("isDirect", False)

    if not is_direct:
        if not cache.get(f"verified_otp_{email}"):
            raise ValueError("Please verify OTP before registration.")

    serializer.save(password=make_password(serializer.validated_data["password"]))

    if not is_direct:
        cache.delete(f"verified_otp_{email}")

    def create(self, request, *args, **kwargs):
        try:
            response = super().create(request, *args, **kwargs)
            response.data = {"message": "Dealer registered successfully.", **response.data}
            return response
        except ValueError as exc:
            return Response({"message": str(exc)}, status=400)


# ---------------------------------------------------------------------------
# Dealer Detail View (Retrieve, Update, Delete)
# ---------------------------------------------------------------------------
class DealerDetailView(RetrieveUpdateDestroyAPIView):
    queryset = Dealer.objects.all()
    serializer_class = DealerSerializer
    permission_classes = [IsAuthenticated]


# ---------------------------------------------------------------------------
# Legacy Dealer Registration - For backward compatibility
# ---------------------------------------------------------------------------
class RegisterDealer(APIView):
    def get_permissions(self):
        return [AllowAny()] if self.request.method.lower() == "post" else [IsAuthenticated()]

    def get(self, request):
        dealers = Dealer.objects.all()
        return Response(DealerSerializer(dealers, many=True).data)

    def post(self, request):
        serializer = DealerSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        email = serializer.validated_data["email"]
        if not cache.get(f"verified_otp_{email}"):
            return Response({"message": "Please verify OTP before registration."}, status=400)

        serializer.validated_data["password"] = make_password(serializer.validated_data["password"])
        serializer.save()
        cache.delete(f"verified_otp_{email}")
        return Response({"message": "Dealer registered successfully."}, status=201)

    def delete(self, request, pk):
        dealer = get_object_or_404(Dealer, pk=pk)
        dealer.delete()
        return Response(status=204)


# ---------------------------------------------------------------------------
# OTP Send & Verify
# ---------------------------------------------------------------------------
class SendOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        if not email:
            return Response({"message": "Email is required."}, status=400)
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
            return Response({"message": "Email and OTP are required."}, status=400)
        if not real_otp:
            return Response({"message": "OTP expired or not found."}, status=400)
        if otp_input != real_otp:
            return Response({"message": "Invalid OTP."}, status=400)

        cache.set(f"verified_otp_{email}", True, timeout=600)
        cache.delete(f"otp_{email}")
        return Response({"message": "OTP verified successfully."})


# ---------------------------------------------------------------------------
# Login View
# ---------------------------------------------------------------------------
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")

        dealer = Dealer.objects.filter(email=email).first()
        if dealer and check_password(password, dealer.password):
            token, _ = Token.objects.get_or_create(user=get_or_create_auth_user(email))
            LoginRecord.objects.create(email=email, user_type="dealer", success=True)
            return Response({
                "message": "Login successful",
                "token": token.key,
                "user_type": "dealer",
                "dealer_id": dealer.id,
                "company_id": dealer.company_id,
                "name": dealer.name,
                "role": "DEALER_ADMIN"
            })
        elif dealer:
            LoginRecord.objects.create(email=email, user_type="dealer", success=False)
            return Response({"message": "Invalid password"}, status=401)

        company = Company.objects.filter(email=email).first()
        if company and check_password(password, company.password):
            token, _ = Token.objects.get_or_create(user=get_or_create_auth_user(email))
            LoginRecord.objects.create(email=email, user_type="company", success=True)
            return Response({
                "message": "Login successful",
                "token": token.key,
                "user_type": "company",
                "company_id": company.id,
                "name": company.name,
                "role": "COMPANY_ADMIN"
            })
        elif company:
            LoginRecord.objects.create(email=email, user_type="company", success=False)
            return Response({"message": "Invalid password"}, status=401)

        return Response({"message": "User not found"}, status=404)


# ---------------------------------------------------------------------------
# Dealer Count View (Protected)
# ---------------------------------------------------------------------------
class DealerCountView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_id = request.query_params.get("company_id")
        count = Dealer.objects.filter(company_id=company_id).count() if company_id else Dealer.objects.count()
        return Response({"dealer_count": count})


# ---------------------------------------------------------------------------
# Machine Installation View (Multipart form support)
# ---------------------------------------------------------------------------

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
    Multipart POST:
        • installation fields
        • photo_files[] (≤ 3 images ≤ 5 MB each)
    """
    serializer = MachineInstallationSerializer(data=request.data, context={"request": request})
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Task ViewSet (for listing tasks)
# ---------------------------------------------------------------------------
class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.all().order_by("-created_at")
    serializer_class = TaskSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
