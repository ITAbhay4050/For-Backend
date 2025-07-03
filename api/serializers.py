"""
serializers.py ― DRF serializers for Comptech Equipment Ltd.
Updated 3 July 2025
"""
from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from .models import (
    Company,
    Dealer,
    MachineInstallation,
    InstallationPhoto,
    Task,
)


# ────────────────────────────────────────────────────────────────
# Company & Dealer
# ────────────────────────────────────────────────────────────────

class CompanySerializer(serializers.ModelSerializer):
    # Never reveal the hashed password; only allow it on write.
    password = serializers.CharField(write_only=True)

    class Meta:
        model = Company
        fields = "__all__"


class DealerSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)

    # Helper flag from your React form (won’t be saved to DB)
    isDirect = serializers.BooleanField(write_only=True, required=False)

    # Write‑only password; hashed again if a raw string is supplied.
    password = serializers.CharField(write_only=True)

    class Meta:
        model = Dealer
        fields = [
            "id",
            "company",
            "company_name",
            "name",
            "email",
            "phone",
            "address",
            "city",
            "state",
            "country",
            "pin_code",
            "gst_no",
            "pan_no",
            "password",
            "created_at",
            "isDirect",
        ]
        read_only_fields = ["created_at"]

    # --- extra validation ---------------------------------------------------

    def validate_phone(self, value: str) -> str:
        # Very basic check; for production consider phonenumbers library
        digits = "".join(filter(str.isdigit, value))
        if len(digits) < 9 or len(digits) > 15:
            raise serializers.ValidationError("Enter a valid phone number.")
        return value

    # --- life‑cycle overrides ----------------------------------------------

    def create(self, validated_data):
        # 1️⃣ discard helper flag
        validated_data.pop("isDirect", None)

        # 2️⃣ always call model manager; model.save() will hash if needed
        return super().create(validated_data)


# ────────────────────────────────────────────────────────────────
# Machine Installation & photos
# ────────────────────────────────────────────────────────────────

class InstallationPhotoSerializer(serializers.ModelSerializer):
    """Read‑only representation of stored photos."""

    class Meta:
        model = InstallationPhoto
        fields = ["id", "photo"]      # URL/path only
        read_only_fields = ["id", "photo"]


class MachineInstallationSerializer(serializers.ModelSerializer):
    # Nested, read‑only list of already‑saved photos
    photos = InstallationPhotoSerializer(many=True, read_only=True)

    # Incoming files – not stored directly on the model
    photo_files = serializers.ListField(
        child=serializers.ImageField(
            max_length=5_000_000,         # 5 MB each
            allow_empty_file=False,
            use_url=False,
        ),
        write_only=True,
        required=False,
        help_text="JPEG/PNG ≤ 5 MB each; maximum 3 files",
    )

    class Meta:
        model = MachineInstallation
        fields = [
            "id",
            "company",
            "dealer",
            "model_number",
            "serial_number",
            "batch_number",
            "invoice_number",
            "client_company_name",
            "client_gst_number",
            "client_contact_person",
            "client_contact_phone",
            "installation_date",
            "installed_by",
            "location",
            "notes",
            "submitted_by_id",
            "submitted_by_role",
            "submitted_by_name",
            "created_at",
            # virtual fields
            "photo_files",
            "photos",
        ]
        read_only_fields = ["id", "created_at", "photos"]

    # --- extra validation ---------------------------------------------------

    def validate_photo_files(self, value):
        if len(value) > 3:
            raise serializers.ValidationError("You can upload a maximum of 3 photos.")
        return value

    # --- life‑cycle overrides ----------------------------------------------

    def create(self, validated_data):
        files = validated_data.pop("photo_files", [])
        installation = super().create(validated_data)   # will run .clean() etc.

        for img in files:
            InstallationPhoto.objects.create(installation=installation, photo=img)

        return installation


# ────────────────────────────────────────────────────────────────
# Task
# ────────────────────────────────────────────────────────────────

class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = "__all__"
        read_only_fields = ["id", "created_at"]

    # Example: enforce deadlines in the future
    def validate_deadline(self, value):
        if value < timezone.now().date():
            raise serializers.ValidationError("Deadline cannot be in the past.")
        if value > timezone.now().date() + timedelta(days=365):
            raise serializers.ValidationError("Deadline cannot be more than a year away.")
        return value
