from django.db import models
from django.contrib.auth.hashers import make_password


class Company(models.Model):
    gst_no = models.CharField(max_length=20)
    name = models.CharField(max_length=255)
    address = models.TextField()
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    pin_code = models.CharField(max_length=20)
    phone = models.CharField(max_length=20)
    email = models.EmailField()
    pan_no = models.CharField(max_length=20)
    password = models.CharField(max_length=128)  # Store hashed password
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.password.startswith('pbkdf2_'):
            self.password = make_password(self.password)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Dealer(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='dealers')  # Dropdown from company
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20)
    address = models.TextField()
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    pin_code = models.CharField(max_length=20)
    gst_no = models.CharField(max_length=20, blank=True, null=True)
    pan_no = models.CharField(max_length=20, blank=True, null=True)
    password = models.CharField(max_length=128)  # Store hashed password
    created_at = models.DateTimeField(auto_now_add=True)
    otp = models.CharField(max_length=6, blank=True, null=True)
    is_verified = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        if not self.password.startswith('pbkdf2_'):
            self.password = make_password(self.password)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.company.name})"
    
class LoginRecord(models.Model):
    email = models.EmailField()
    user_type = models.CharField(max_length=20, choices=[('dealer', 'Dealer'), ('company', 'Company')])
    login_time = models.DateTimeField(auto_now_add=True)
    success = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.email} - {self.user_type} - {'Success' if self.success else 'Failed'}"


class MachineInstallation(models.Model):
    # Related parties
    company = models.ForeignKey(Company, on_delete=models.CASCADE, null=True, blank=True)
    dealer = models.ForeignKey(Dealer, on_delete=models.CASCADE, null=True, blank=True)
    
    # Machine Info
    model_number = models.CharField(max_length=100)
    serial_number = models.CharField(max_length=100, unique=True)
    batch_number = models.CharField(max_length=100, blank=True, null=True)
    invoice_number = models.CharField(max_length=100, blank=True, null=True)

    # Client Info (for company users)
    client_company_name = models.CharField(max_length=255, blank=True, null=True)
    client_gst_number = models.CharField(max_length=30, blank=True, null=True)
    client_contact_person = models.CharField(max_length=100, blank=True, null=True)
    client_contact_phone = models.CharField(max_length=20, blank=True, null=True)

    # Installation
    installation_date = models.DateField()
    installed_by = models.CharField(max_length=100)
    location = models.TextField()
    notes = models.TextField(blank=True, null=True)
    # Metadata
    submitted_by_id = models.CharField(max_length=100)
    submitted_by_role = models.CharField(max_length=100)
    submitted_by_name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Installation: {self.model_number} - {self.serial_number}"
class InstallationPhoto(models.Model):
    installation = models.ForeignKey(MachineInstallation, on_delete=models.CASCADE, related_name="photo_set")
    photo = models.ImageField(upload_to="Machine_install/")  