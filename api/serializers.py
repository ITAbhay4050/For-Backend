from rest_framework import serializers
from .models import *

class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = '__all__'

class DealerSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='company.name', read_only=True)

    class Meta:
        model = Dealer
        fields = [
            'id', 'company', 'company_name', 'name', 'email', 'phone', 'address', 
            'city', 'state', 'country', 'pin_code', 'gst_no', 'pan_no', 
            'password', 'created_at'
        ]
class MachineInstallationSerializer(serializers.ModelSerializer):
    photos = serializers.ListField(
        child=serializers.ImageField(max_length=5_000_000, allow_empty_file=False, use_url=False),
        write_only=True,
        required=False
    )

    class Meta:
        model = MachineInstallation
        fields = '__all__'

    def validate_photos(self, value):
        if len(value) > 3:
            raise serializers.ValidationError("You can upload maximum 3 photos.")
        return value

    def create(self, validated_data):
        photos = validated_data.pop("photos", [])
        installation = MachineInstallation.objects.create(**validated_data)

        for img in photos:
            InstallationPhoto.objects.create(installation=installation, photo=img)

        return installation
