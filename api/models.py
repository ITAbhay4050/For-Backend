from django.db import models
from django.core.exceptions import ValidationError
from django.contrib.auth.hashers import make_password, identify_hasher
from django.core.validators import RegexValidator


class Company(models.Model):
    """Registered manufacturing/servicing companies."""

    gst_no = models.CharField(max_length=20)
    name = models.CharField(max_length=255)
    address = models.TextField()
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    pin_code = models.CharField(max_length=20)
    # This regex allows for a leading '+' (optional), followed by 1 to 3 digits (country code),
    # then 9 to 15 digits for the rest of the number. This is a common international format.
    # For a more strict Indian phone number validation (starting with 6-9 and 10 digits):
    # r'^(?:(?:\+|0{0,2})91[\-\s]?)?[6-9]\d{9}$'
    phone = models.CharField(
        max_length=20,
        validators=[
            RegexValidator(r'^\+?1?\d{9,15}$', message="Enter a valid phone number.")
        ],
    )
    email = models.EmailField(unique=True)
    pan_no = models.CharField(max_length=20)
    password = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "Companies"

    def save(self, *args, **kwargs):
        # Hash password only if it's not already hashed
        try:
            identify_hasher(self.password)
        except (ValueError, TypeError):
            self.password = make_password(self.password)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Dealer(models.Model):
    """Dealers associated with a Company (one-to-many)."""

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="dealers")
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    phone = models.CharField(
        max_length=20,
        validators=[
            RegexValidator(r'^\+?1?\d{9,15}$', message="Enter a valid phone number.")
        ],
    )
    address = models.TextField()
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    pin_code = models.CharField(max_length=20)
    gst_no = models.CharField(max_length=30, blank=True, null=True) # Increased max_length for GST
    pan_no = models.CharField(max_length=20, blank=True, null=True)
    password = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)
    otp = models.CharField(max_length=6, blank=True, null=True)
    otp_created_at = models.DateTimeField(blank=True, null=True)
    is_verified = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        # Hash password only if it's not already hashed
        try:
            identify_hasher(self.password)
        except (ValueError, TypeError):
            self.password = make_password(self.password)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.company.name if self.company else 'No Company'})"


class Employee(models.Model):
    """Company / Dealer employees + system admins."""

    ROLE_CHOICES = [
        ("APPLICATION_ADMIN", "System Admin"),
        ("COMPANY_ADMIN", "Company Admin"),
        ("COMPANY_EMPLOYEE", "Company Employee"),
        ("DEALER_ADMIN", "Dealer Admin"),
        ("DEALER_EMPLOYEE", "Dealer Employee"),
    ]

    company = models.ForeignKey(
        "Company",
        on_delete=models.CASCADE,
        related_name="employees",
        null=True,
        blank=True,
    )
    dealer = models.ForeignKey(
        "Dealer",
        on_delete=models.CASCADE,
        related_name="employees",
        null=True,
        blank=True,
    )

    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    phone = models.CharField(
        max_length=20,
        validators=[
            RegexValidator(r"^\+?1?\d{9,15}$", "Enter a valid phone number.")
        ],
    )
    department = models.CharField(max_length=100, blank=True, null=True)
    role = models.CharField(max_length=30, choices=ROLE_CHOICES)
    password = models.CharField(max_length=128)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "Employees"

    def clean(self):
        # Validate company/dealer association based on role
        if self.role in ("COMPANY_ADMIN", "COMPANY_EMPLOYEE"):
            if not self.company:
                raise ValidationError("Company field is required for company roles.")
            if self.dealer:
                raise ValidationError("Employee cannot be associated with both a company and a dealer.")
        elif self.role in ("DEALER_ADMIN", "DEALER_EMPLOYEE"):
            if not self.dealer:
                raise ValidationError("Dealer field is required for dealer roles.")
            if self.company:
                raise ValidationError("Employee cannot be associated with both a company and a dealer.")
        elif self.role == "APPLICATION_ADMIN":
            if self.company or self.dealer:
                raise ValidationError(
                    "Application Admin should not be associated with a company or dealer."
                )

    def save(self, *args, **kwargs):
        self.full_clean()  # Call clean method before saving
        # Hash password only if it's not already hashed
        try:
            identify_hasher(self.password)
        except (ValueError, TypeError):
            self.password = make_password(self.password)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} – {self.get_role_display()}"


class LoginRecord(models.Model):
    """Audit trail for login attempts (success/failure)."""

    USER_TYPE_CHOICES = [
        ("dealer", "Dealer"),
        ("company", "Company"),
        ("employee", "Employee"), # Added employee as a user type
    ]

    email = models.EmailField()
    user_type = models.CharField(max_length=20, choices=USER_TYPE_CHOICES)
    login_time = models.DateTimeField(auto_now_add=True)
    success = models.BooleanField(default=False)

    class Meta:
        ordering = ["-login_time"]

    def __str__(self):
        status = "Success" if self.success else "Failed"
        return f"{self.email} – {self.user_type} – {status}"


class MachineInstallation(models.Model):
    """Physical machine installations done by dealers or companies."""

    company = models.ForeignKey('Company', on_delete=models.CASCADE, null=True, blank=True)
    dealer = models.ForeignKey('Dealer', on_delete=models.CASCADE, null=True, blank=True)

    # Machine details (auto-filled from Munim006 DB)
    item_name = models.CharField(max_length=255, blank=True, null=True)
    item_code = models.CharField(max_length=100, blank=True, null=True)
    batch_number = models.CharField(max_length=100, null=True, blank=True)
    
    invoice_number = models.CharField(max_length=100, blank=True, null=True)
    purchase_date = models.DateField(blank=True, null=True)

    # Client details
    client_company_name = models.CharField(max_length=255, null=True, blank=True)
    client_gst_number = models.CharField(max_length=30, null=True, blank=True) # Increased max_length for GST
    client_contact_person = models.CharField(max_length=100, null=True, blank=True)
    client_contact_phone = models.CharField(max_length=20, null=True, blank=True)

    # Installation details
    installation_date = models.DateField()
    installed_by = models.CharField(max_length=100)
    location = models.TextField()
    notes = models.TextField(blank=True, null=True)

    # Submission metadata
    submitted_by = models.ForeignKey(
        'Employee',
        on_delete=models.SET_NULL,
        null=True,
        related_name='submitted_installations'
    )
    # submitted_by_role and submitted_by_name can be redundant if submitted_by is always set.
    # Consider removing these and deriving from submitted_by if performance isn't an issue.
    submitted_by_role = models.CharField(max_length=100) 
    submitted_by_name = models.CharField(max_length=100)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Machine Installation"

    def clean(self):
        # Ensure either company or dealer is set, but not both
        if not self.company and not self.dealer:
            raise ValidationError("Either 'company' or 'dealer' must be set for an installation.")
        if self.company and self.dealer:
            raise ValidationError("An installation cannot be associated with both a company and a dealer.")

        # Validate submitted_by based on company/dealer
        if self.submitted_by:
            is_company_role = self.submitted_by.role in ["COMPANY_ADMIN", "COMPANY_EMPLOYEE"]
            is_dealer_role = self.submitted_by.role in ["DEALER_ADMIN", "DEALER_EMPLOYEE"]

            if is_company_role:
                if not self.company or self.submitted_by.company != self.company:
                    raise ValidationError("Submitted employee's company does not match installation company.")
                if self.dealer: # If it's a company employee, it shouldn't be associated with a dealer installation
                    raise ValidationError("Company employee cannot submit a dealer installation.")
            elif is_dealer_role:
                if not self.dealer or self.submitted_by.dealer != self.dealer:
                    raise ValidationError("Submitted employee's dealer does not match installation dealer.")
                if self.company: # If it's a dealer employee, it shouldn't be associated with a company installation
                    raise ValidationError("Dealer employee cannot submit a company installation.")
            elif self.submitted_by.role == "APPLICATION_ADMIN":
                 # Application admins can submit for either company or dealer.
                 # The current logic allows this if only one of company/dealer is set on the installation.
                 pass
            else:
                raise ValidationError("Invalid submitted_by role for installation.")
        
        # Populate submitted_by_role and submitted_by_name automatically
        if self.submitted_by:
            self.submitted_by_role = self.submitted_by.get_role_display()
            self.submitted_by_name = self.submitted_by.name


    def save(self, *args, **kwargs):
        self.full_clean()  # Call clean method before saving
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Installation: {self.item_name} – Batch No: {self.batch_number}"


class InstallationPhoto(models.Model):
    """Photos related to a specific machine installation."""

    installation = models.ForeignKey(
        MachineInstallation,
        on_delete=models.CASCADE,
        related_name="photos",
    )
    photo = models.ImageField(upload_to="machine_install/") # Ensure 'machine_install/' exists in MEDIA_ROOT

    def __str__(self):
        return f"Photo for {self.installation.batch_number}"


class Task(models.Model):
    """General task/issue tracker."""

    PRIORITY_CHOICES = [
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
        ("urgent", "Urgent"),
    ]

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("in-progress", "In Progress"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ]

    title = models.CharField(max_length=255)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    deadline = models.DateField()

    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default="medium")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")

    assigner_id = models.CharField(max_length=100, default="user_1")
    assignee_id = models.CharField(max_length=100, default="user_1")
    machine_id = models.CharField(max_length=100, default="NA")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title

class AccountMaster(models.Model):
    """
    Model representing an external 'accountmaster' table from Munim006 DB.
    Set `managed = False` as Django will not manage this table's schema.
    """
    accountmasterid = models.AutoField(
        primary_key=True, db_column='AccountMasterId'
    )
    pan_no = models.CharField(max_length=20, db_column='panno')
    accountname = models.CharField(max_length=255, db_column='accountname')
    email = models.EmailField(db_column='email')
    gstno = models.CharField(max_length=20, db_column='gstno')

    class Meta:
        managed = False  # Because this is from external MSSQL DB
        db_table = 'accountmaster'
        app_label = 'api' # Ensure this matches your app name

    def __str__(self):
        return self.accountname