from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    RegisterCompany,
    DealerListView,
    DealerDetailView,
    DealerCountView,
    RegisterEmployee,
    EmployeeDetailView,
    SendOTPView,
    VerifyOTPView,
    LoginView,
    MachineInstallationListView,
    create_machine_installation,
    TaskViewSet,
    check_batch_unique,
    GetDealerDataByBatch,  # Renamed for clarity as it fetches by batch number
    get_machine_details_by_batch,
    GetPartyDetailsByGST,
    CompanyListView,  # Added the explicit CompanyListView for GET /companies/
)

# Router setup for TaskViewSet
router = DefaultRouter()
router.register(r"tasks", TaskViewSet, basename="task")

urlpatterns = [
    # ───────────── Authentication & Registration ─────────────
    path("register/company/", RegisterCompany.as_view(), name="register_company"),
    # It's generally better to have a dedicated ListAPIView for listing if RegisterCompany also handles POST
    path("companies/", CompanyListView.as_view(), name="company_list"),
    path("register/employee/", RegisterEmployee.as_view(), name="register_employee"),
    path("login/", LoginView.as_view(), name="login"),
    path("send-otp/", SendOTPView.as_view(), name="send_otp"),
    path("verify-otp/", VerifyOTPView.as_view(), name="verify_otp"),

    # ───────────── Dealer Management ─────────────
    path("dealers/", DealerListView.as_view(), name="dealer_list"),
    path("dealers/<int:pk>/", DealerDetailView.as_view(), name="dealer_detail"),
    path("dealers/count/", DealerCountView.as_view(), name="dealer_count"),
    # Renamed the path to reflect fetching by batch_no
    path("dealers/get-data-by-batch/", GetDealerDataByBatch.as_view(), name="get_dealer_data_by_batch"),

    # ───────────── Employee Management ─────────────
    # RegisterEmployee handles listing and creation, so no separate path for listing here
    # path("employees/", RegisterEmployee.as_view(), name="employee_list"), # This is handled by RegisterEmployee's GET method
    path("employees/<int:pk>/", EmployeeDetailView.as_view(), name="employee_detail"),

    # ───────────── Machine Installation ─────────────
    path("installations/create/", create_machine_installation, name="create_installation"),
    path("installations/list/", MachineInstallationListView.as_view(), name="installation_list"),
    path("installations/check-batch-unique/", check_batch_unique, name="check_batch_unique"),
    path("installations/get-details-by-batch/", get_machine_details_by_batch, name="get_machine_details_by_batch"),

    # Renamed the path for consistency and clarity (it fetches party details by GST)
    path("party/get-details-by-gst/", GetPartyDetailsByGST.as_view(), name="get_party_details_by_gst"),

    # ───────────── Tasks Router URLs ─────────────
    path("", include(router.urls)),
]