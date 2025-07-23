from django.contrib import admin
from django.contrib import messages
from django.db.models import Q
from .models import Company, Dealer, LoginRecord, MachineInstallation, Task, Employee
from django.contrib.auth.hashers import make_password

@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ('name', 'city', 'state', 'country', 'gst_no', 'created_at', 'email')
    search_fields = ('name', 'gst_no', 'email')

@admin.register(Dealer)
class DealerAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'email', 'phone', 'company', 'city', 'state', 'created_at')
    search_fields = ('name', 'email', 'company__name')
    list_filter = ('company', 'state', 'created_at')

@admin.register(LoginRecord)
class LoginRecordAdmin(admin.ModelAdmin):
    list_display = ('email', 'user_type', 'login_time', 'success')
    list_filter = ('user_type', 'success')
    search_fields = ('email',)

@admin.register(MachineInstallation)
class MachineInstallationAdmin(admin.ModelAdmin):
    list_display = [ 'batch_number','installation_date', 'submitted_by_name']

@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("title", "deadline", "priority", "status", "assigner_id", "assignee_id")
    search_fields = ("title", "description", "status", "priority")
    list_filter = ("priority", "status")

@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "phone", "role_display", 
                   "company_name", "dealer_name", "is_active", 
                   "created_at")
    list_filter = ("role", "is_active", "company", "dealer")
    search_fields = ("name", "email", "phone", "company__name", "dealer__name")
    ordering = ('-created_at',)
    list_select_related = ('company', 'dealer')
    actions = ['activate_employees', 'deactivate_employees']
    
    fieldsets = (
        (None, {
            'fields': ('name', 'email', 'phone', 'department', 'role', 'password')
        }),
        ('Relationships', {
            'fields': ('company', 'dealer'),
        }),
        ('Status', {
            'fields': ('is_active',),
        }),
    )
    
    readonly_fields = ('created_at',)
    
    def get_readonly_fields(self, request, obj=None):
        if obj:  # Editing an existing object
            return self.readonly_fields + ('role', 'company', 'dealer')
        return self.readonly_fields
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if not request.user.is_superuser:
            # Filter employees based on the current user's permissions
            qs = qs.filter(
                Q(company__admin=request.user) | 
                Q(dealer__admin=request.user) |
                Q(pk=request.user.pk)
            )
        return qs
    
    def role_display(self, obj):
        return obj.get_role_display()
    role_display.short_description = 'Role'
    role_display.admin_order_field = 'role'
    
    def company_name(self, obj):
        return obj.company.name if obj.company else "—"
    company_name.short_description = 'Company'
    company_name.admin_order_field = 'company__name'
    
    def dealer_name(self, obj):
        return obj.dealer.name if obj.dealer else "—"
    dealer_name.short_description = 'Dealer'
    dealer_name.admin_order_field = 'dealer__name'
    
    def activate_employees(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(
            request, 
            f"Successfully activated {updated} employee(s).", 
            messages.SUCCESS
        )
    activate_employees.short_description = "Activate selected employees"
    
    def deactivate_employees(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(
            request, 
            f"Successfully deactivated {updated} employee(s).", 
            messages.SUCCESS
        )
    deactivate_employees.short_description = "Deactivate selected employees"


def save_model(self, request, obj, form, change):
    if not change:  # Only for new employee
        obj.password = make_password(form.cleaned_data['password'])
    super().save_model(request, obj, form, change)
