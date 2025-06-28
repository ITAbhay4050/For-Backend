# api/views.py
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, parser_classes
from django.contrib.auth.hashers import check_password
from django.contrib.auth.models import User as AuthUser
from django.core.mail import send_mail
from django.core.cache import cache
from rest_framework.permissions import AllowAny 

from .serializers import CompanySerializer, DealerSerializer,MachineInstallationSerializer
from .models import Company, Dealer, LoginRecord
from .utils import generate_otp, send_otp_email


# ========== Helper ==========
def get_or_create_auth_user(email: str) -> AuthUser:
    """
    Create or fetch a minimal Django auth_user tied to this email.
    Needed so DRF TokenAuth can associate a token with a User instance.
    """
    return AuthUser.objects.get_or_create(
        username=email.lower(), defaults={"email": email.lower(), "password": "!"}
    )[0]


# ========== Company Registration ==========
class RegisterCompany(APIView):
    permission_classes = [AllowAny] 
    def get(self, request):
        companies = Company.objects.all()
        serializer = CompanySerializer(companies, many=True)
        return Response(serializer.data)

    def post(self, request):
        email = request.data.get("email")
        if Company.objects.filter(email=email).exists():
            return Response(
                {"message": "A company with this email already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CompanySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        company = serializer.save()

        # --- Send welcome mail (best-effort) ---
        try:
            send_mail(
                subject="🎉 Welcome to Comptech Equipment LIMITED!",
                message=f"Dear {company.name},\n\nWelcome aboard! …",
                from_email="it02comptech@gmail.com",
                recipient_list=[company.email],
                fail_silently=False,
            )
        except Exception as e:
            # Email failed but registration succeeded
            return Response(
                {
                    "message": "Company registered, but welcome email failed.",
                    "error": str(e),
                    "data": serializer.data,
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(
            {
                "message": "Company registered successfully and welcome email sent!",
                "data": serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )


# ========== Dealer Registration (OTP) ==========
class RegisterDealer(APIView):
    permission_classes = [AllowAny] 
    def get(self, request):
        dealers = Dealer.objects.all()
        return Response(DealerSerializer(dealers, many=True).data)

    def post(self, request):
        serializer = DealerSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data["email"]
        if not cache.get(f"verified_otp_{email}"):
            return Response(
                {"message": "Please verify OTP before registration."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer.save()
        cache.delete(f"verified_otp_{email}")
        return Response({"message": "Dealer registered successfully."}, status=status.HTTP_201_CREATED)


# ========== OTP Flow ==========
class SendOTPView(APIView):
    permission_classes = [AllowAny] 
    def post(self, request):
        email = request.data.get("email")
        if not email:
            return Response({"message": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

        otp = generate_otp()
        send_otp_email(email, otp)
        cache.set(f"otp_{email}", otp, timeout=300)  # 5 min
        return Response({"message": f"OTP sent to {email}."})


class VerifyOTPView(APIView):
    permission_classes = [AllowAny] 
    def post(self, request):
        email = request.data.get("email")
        otp_input = request.data.get("otp")
        real_otp = cache.get(f"otp_{email}")

        if not (email and otp_input):
            return Response({"message": "Email and OTP are required."}, status=status.HTTP_400_BAD_REQUEST)
        if not real_otp:
            return Response({"message": "OTP expired or not found."}, status=status.HTTP_400_BAD_REQUEST)
        if otp_input != real_otp:
            return Response({"message": "Invalid OTP."}, status=status.HTTP_400_BAD_REQUEST)

        cache.set(f"verified_otp_{email}", True, timeout=600)
        cache.delete(f"otp_{email}")
        return Response({"message": "OTP verified successfully."})


# ========== Login ==========
class LoginView(APIView):
    permission_classes = [AllowAny] 
    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")
        print("Login attempt from:", email)

        # -------- Dealer login --------
        dealer = Dealer.objects.filter(email=email).first()
        if dealer and check_password(password, dealer.password):
            token = Token.objects.get_or_create(user=get_or_create_auth_user(email))[0]
            LoginRecord.objects.create(email=email, user_type="dealer", success=True)
            return Response(
                {
                    "message": "Login successful",
                    "token": token.key,
                    "user_type": "dealer",
                    "dealer_id": dealer.id,
                    "company_id": dealer.company_id,
                    "name": dealer.name,
                    "role": "DEALER_ADMIN",  # adjust if needed
                }
            )
        elif dealer:
            LoginRecord.objects.create(email=email, user_type="dealer", success=False)
            return Response({"message": "Invalid password"}, status=status.HTTP_401_UNAUTHORIZED)

        # -------- Company login --------
        company = Company.objects.filter(email=email).first()
        if company and check_password(password, company.password):
            token = Token.objects.get_or_create(user=get_or_create_auth_user(email))[0]
            LoginRecord.objects.create(email=email, user_type="company", success=True)
            return Response(
                {
                    "message": "Login successful",
                    "token": token.key,
                    "user_type": "company",
                    "company_id": company.id,
                    "name": company.name,
                    "role": "COMPANY_ADMIN",  # adjust if needed
                }
            )
        elif company:
            LoginRecord.objects.create(email=email, user_type="company", success=False)
            return Response({"message": "Invalid password"}, status=status.HTTP_401_UNAUTHORIZED)

        return Response({"message": "User not found"}, status=status.HTTP_404_NOT_FOUND)


# ========== Dealer Count (protected) ==========
class DealerCountView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_id = request.query_params.get("company_id")
        count = Dealer.objects.filter(company_id=company_id).count() if company_id else Dealer.objects.count()
        return Response({"dealer_count": count})
@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def create_machine_installation(request):
    serializer = MachineInstallationSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response({
            "message": "Installation saved successfully",
            "data": serializer.data
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)