from django.urls import path
from .views import (
    RegisterCompany,
    RegisterDealer,
    SendOTPView,
    VerifyOTPView,
    LoginView,DealerCountView,create_machine_installation,
)

urlpatterns = [
    path('register/company/', RegisterCompany.as_view(), name='register_company'),
    path('register/dealer/', RegisterDealer.as_view(), name='register_dealer'),
    path('send-otp/', SendOTPView.as_view(), name='send_otp'),
    path('verify-otp/', VerifyOTPView.as_view(), name='verify_otp'),
    path('login/', LoginView.as_view(), name='login'),  # ✅ Add login URL
     path('dealers/count/', DealerCountView.as_view(), name='dealer_count'),
      path('installations/create/', create_machine_installation, name='create-installation'),
      
]
