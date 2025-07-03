"""
api/urls.py
URL configuration for Comptech Equipment LIMITED REST API.
Every endpoint ends with a trailing slash; the React front‑end relies on this.
Updated 3 July 2025.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import create_machine_installation
# Import views and viewsets
from . import views
from .views import (
    RegisterCompany,
    RegisterDealer,
    LoginView,
    SendOTPView,
    VerifyOTPView,
    DealerListView,
    DealerDetailView,
    DealerCountView,
    create_machine_installation,
    MachineInstallationListView,
    TaskViewSet,
)

app_name = "api"  # Enables {% url 'api:register_company' %} etc.

# ────────────────────────────────────────────────────────────────
# DRF ViewSet router (auto‑registers RESTful endpoints)
# ────────────────────────────────────────────────────────────────

router = DefaultRouter()
router.register(r"tasks", TaskViewSet, basename="task")  # /api/tasks/

# Future: enable below to auto‑generate dealer & installation endpoints
# router.register(r"dealers", views.DealerViewSet, basename="dealer")
# router.register(r"installations", views.MachineInstallationViewSet, basename="installation")

# ────────────────────────────────────────────────────────────────
# API routes (Function & Class based views)
# ────────────────────────────────────────────────────────────────

urlpatterns: list = [
    # ──────────────── Registration & Login ────────────────
    path("register/company/", RegisterCompany.as_view(), name="register_company"),
    path("register/dealer/", RegisterDealer.as_view(), name="register_dealer"),
    path("login/", LoginView.as_view(), name="login"),

    # ──────────────── OTP (Send / Verify) ────────────────
    path("send-otp/", SendOTPView.as_view(), name="send_otp"),
    path("verify-otp/", VerifyOTPView.as_view(), name="verify_otp"),

    # ──────────────── Dealer Views (List / Detail / Count) ────────────────
    path("dealers/", DealerListView.as_view(), name="dealer_list"),
    path("dealers/<str:pk>/", DealerDetailView.as_view(), name="dealer_detail"),
    path("dealers/count/", DealerCountView.as_view(), name="dealer_count"),

    # ──────────────── Machine Installation ────────────────
    path("installations/create/", create_machine_installation, name="create_installation"),
    path("installations/", MachineInstallationListView.as_view(), name="installation_list"),

    # ──────────────── ViewSets (Task endpoints) ────────────────
    path("", include(router.urls)),  # → /api/tasks/, /api/tasks/<id>/
]
