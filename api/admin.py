from django.contrib import admin
from .models import Company, Dealer , LoginRecord

@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ('name', 'contact_person', 'city', 'state', 'country', 'gst_no', 'created_at','contact_email')
    search_fields = ('name', 'gst_no', 'contact_email')

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
