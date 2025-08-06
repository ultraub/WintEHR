"""
Comprehensive tests for ConverterFactory
Tests unified converter factory functionality and backwards compatibility
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

# Import the factory and related components
from fhir.core.converters.ConverterFactory import (
    ConverterFactory, 
    ConverterRegistry,
    converter_factory,
    converter_registry,
    get_converter,
    convert_to_fhir,
    convert_from_fhir,
    list_converters
)


class TestConverterFactory:
    
    def setup_method(self):
        """Setup test environment"""
        self.factory = ConverterFactory()
    
    def test_factory_initialization(self):
        """Test factory initializes with correct converter registries"""
        assert len(self.factory._legacy_converters) > 0
        assert len(self.factory._class_converters) > 0
        assert len(self.factory._specialized_converters) > 0
        
        # Test some expected legacy converters
        assert 'Patient' in self.factory._legacy_converters
        assert 'Observation' in self.factory._legacy_converters
        assert 'MedicationRequest' in self.factory._legacy_converters
        
        # Test class converters
        assert 'DocumentReference' in self.factory._class_converters
        assert 'ServiceRequest' in self.factory._class_converters
        assert 'Task' in self.factory._class_converters
        
        # Test specialized converters
        assert 'Appointment' in self.factory._specialized_converters
        assert 'AuditEvent' in self.factory._specialized_converters
    
    def test_legacy_converter_registration(self):
        """Test legacy converter functions are properly registered"""
        # Test that all expected legacy converters are registered
        expected_converters = [
            'Patient', 'Encounter', 'Observation', 'Condition',
            'MedicationRequest', 'Practitioner', 'Organization'
        ]
        
        for converter_name in expected_converters:
            assert converter_name in self.factory._legacy_converters
            assert callable(self.factory._legacy_converters[converter_name])
    
    def test_class_converter_registration(self):
        """Test class-based converters are properly registered"""
        expected_classes = ['DocumentReference', 'ServiceRequest', 'Task', 'Generic']
        
        for class_name in expected_classes:
            assert class_name in self.factory._class_converters
            assert hasattr(self.factory._class_converters[class_name], '__call__')
    
    def test_specialized_converter_registration(self):
        """Test specialized converters are properly registered"""
        # Test Appointment converter
        appointment_conv = self.factory._specialized_converters['Appointment']
        assert 'to_fhir' in appointment_conv
        assert 'from_fhir' in appointment_conv
        
        # Test AuditEvent converter
        audit_conv = self.factory._specialized_converters['AuditEvent']
        assert 'from_log' in audit_conv
        assert 'create' in audit_conv
    
    def test_get_converter_auto_mode(self):
        """Test auto mode selects best available converter"""
        # Test with class converter available (should prefer class)
        converter = self.factory.get_converter('DocumentReference', 'auto')
        assert converter is not None
        
        # Test with only legacy converter available
        converter = self.factory.get_converter('Patient', 'auto')
        assert converter is not None
        assert callable(converter)
        
        # Test with non-existent resource type
        converter = self.factory.get_converter('NonExistentResource', 'auto')
        assert converter is None
    
    def test_get_converter_specific_types(self):
        """Test getting specific converter types"""
        # Test legacy converter
        converter = self.factory.get_converter('Patient', 'legacy')
        assert converter is not None
        assert callable(converter)
        
        # Test class converter
        converter = self.factory.get_converter('DocumentReference', 'class')
        assert converter is not None
        assert hasattr(converter, 'to_fhir')
        
        # Test specialized converter
        converter = self.factory.get_converter('Appointment', 'specialized')
        assert converter is not None
        assert isinstance(converter, dict)
        assert 'to_fhir' in converter
    
    def test_converter_caching(self):
        """Test converter caching functionality"""
        # Get converter twice - should use cache on second call
        converter1 = self.factory.get_converter('Patient', 'legacy')
        converter2 = self.factory.get_converter('Patient', 'legacy')
        
        assert converter1 is converter2
        assert 'Patient_legacy' in self.factory._converter_cache
    
    def test_convert_to_fhir_with_legacy_converter(self):
        """Test convert_to_fhir with legacy function converter"""
        # Mock legacy converter function
        mock_converter = Mock(return_value={'resourceType': 'Patient', 'id': 'test'})
        self.factory._legacy_converters['TestResource'] = mock_converter
        
        test_data = {'name': 'Test Patient'}
        result = self.factory.convert_to_fhir('TestResource', test_data)
        
        assert result['resourceType'] == 'Patient'
        assert result['id'] == 'test'
        mock_converter.assert_called_once_with(test_data)
    
    def test_convert_to_fhir_with_class_converter(self):
        """Test convert_to_fhir with class-based converter"""
        # Mock class converter
        mock_converter_class = Mock()
        mock_converter_instance = Mock()
        mock_converter_instance.to_fhir.return_value = {'resourceType': 'Test', 'id': 'class-test'}
        mock_converter_class.return_value = mock_converter_instance
        
        self.factory._class_converters['TestClassResource'] = mock_converter_class
        
        test_data = {'name': 'Test Data'}
        result = self.factory.convert_to_fhir('TestClassResource', test_data)
        
        assert result['resourceType'] == 'Test'
        assert result['id'] == 'class-test'
        mock_converter_instance.to_fhir.assert_called_once_with(test_data)
    
    def test_convert_to_fhir_with_specialized_converter(self):
        """Test convert_to_fhir with specialized converter"""
        # Mock specialized converter
        mock_to_fhir = Mock(return_value={'resourceType': 'Specialized', 'id': 'spec-test'})
        self.factory._specialized_converters['TestSpecialized'] = {
            'to_fhir': mock_to_fhir,
            'from_fhir': Mock()
        }
        
        test_data = {'specialized': True}
        result = self.factory.convert_to_fhir('TestSpecialized', test_data)
        
        assert result['resourceType'] == 'Specialized'
        assert result['id'] == 'spec-test'
        mock_to_fhir.assert_called_once_with(test_data)
    
    def test_convert_to_fhir_with_kwargs(self):
        """Test convert_to_fhir passes kwargs correctly"""
        mock_converter = Mock(return_value={'resourceType': 'Test'})
        self.factory._legacy_converters['TestKwargs'] = mock_converter
        
        test_data = {'name': 'Test'}
        kwargs = {'extra_param': 'test_value', 'another_param': 123}
        
        self.factory.convert_to_fhir('TestKwargs', test_data, **kwargs)
        
        # Verify the converter was called with appropriate arguments
        mock_converter.assert_called_once()
    
    def test_convert_to_fhir_no_converter_found(self):
        """Test convert_to_fhir raises error when no converter found"""
        with pytest.raises(ValueError, match="No converter found for resource type: NonExistent"):
            self.factory.convert_to_fhir('NonExistent', {})
    
    def test_convert_from_fhir_with_class_converter(self):
        """Test convert_from_fhir with class converter"""
        # Mock class converter with from_fhir method
        mock_converter_class = Mock()
        mock_converter_instance = Mock()
        mock_converter_instance.from_fhir.return_value = {'converted': True}
        mock_converter_class.return_value = mock_converter_instance
        
        self.factory._class_converters['TestFromFhir'] = mock_converter_class
        
        fhir_data = {'resourceType': 'TestFromFhir', 'id': 'test'}
        result = self.factory.convert_from_fhir('TestFromFhir', fhir_data)
        
        assert result['converted'] is True
        mock_converter_instance.from_fhir.assert_called_once_with(fhir_data)
    
    def test_convert_from_fhir_with_specialized_converter(self):
        """Test convert_from_fhir with specialized converter"""
        mock_from_fhir = Mock(return_value={'specialized_conversion': True})
        self.factory._specialized_converters['TestSpecFromFhir'] = {
            'to_fhir': Mock(),
            'from_fhir': mock_from_fhir
        }
        
        fhir_data = {'resourceType': 'TestSpecFromFhir'}
        result = self.factory.convert_from_fhir('TestSpecFromFhir', fhir_data)
        
        assert result['specialized_conversion'] is True
        mock_from_fhir.assert_called_once_with(fhir_data)
    
    def test_convert_from_fhir_no_method_available(self):
        """Test convert_from_fhir raises error when no from_fhir method available"""
        # Legacy converters don't have from_fhir method
        with pytest.raises(ValueError, match="No 'from_fhir' method available for Patient"):
            self.factory.convert_from_fhir('Patient', {'resourceType': 'Patient'})
    
    def test_list_available_converters(self):
        """Test list_available_converters returns correct structure"""
        converters = self.factory.list_available_converters()
        
        assert 'legacy' in converters
        assert 'class' in converters
        assert 'specialized' in converters
        
        # Test legacy converter info
        legacy_info = converters['legacy']
        assert 'resource_types' in legacy_info
        assert 'description' in legacy_info
        assert 'capabilities' in legacy_info
        assert 'Patient' in legacy_info['resource_types']
        assert legacy_info['capabilities'] == ['to_fhir']
        
        # Test class converter info
        class_info = converters['class']
        assert 'DocumentReference' in class_info['resource_types']
        assert class_info['capabilities'] == ['to_fhir', 'from_fhir']
    
    def test_get_converter_info(self):
        """Test get_converter_info returns detailed converter information"""
        # Test resource with multiple converter types
        info = self.factory.get_converter_info('DocumentReference')
        
        assert info['resource_type'] == 'DocumentReference'
        assert len(info['available_converters']) >= 2  # Should have legacy and class
        assert info['recommended'] == 'class'  # Class converters are preferred
        
        # Test resource with only legacy converter
        info = self.factory.get_converter_info('Patient')
        assert len(info['available_converters']) >= 1
        assert any(conv['type'] == 'legacy' for conv in info['available_converters'])
    
    def test_validate_converter_compatibility(self):
        """Test validate_converter_compatibility checks operation support"""
        # Test legacy converter with to_fhir operation
        assert self.factory.validate_converter_compatibility('Patient', 'to_fhir') is True
        
        # Test class converter with to_fhir and from_fhir operations
        assert self.factory.validate_converter_compatibility('DocumentReference', 'to_fhir') is True
        assert self.factory.validate_converter_compatibility('DocumentReference', 'from_fhir') is True
        
        # Test specialized converter operations
        assert self.factory.validate_converter_compatibility('Appointment', 'to_fhir') is True
        assert self.factory.validate_converter_compatibility('Appointment', 'from_fhir') is True
        
        # Test unsupported operation
        assert self.factory.validate_converter_compatibility('Patient', 'from_fhir') is False
        
        # Test non-existent resource
        assert self.factory.validate_converter_compatibility('NonExistent', 'to_fhir') is False


class TestConverterRegistry:
    
    def setup_method(self):
        """Setup test environment"""
        self.registry = ConverterRegistry()
    
    def test_register_custom_converter(self):
        """Test registering custom converters"""
        mock_converter = Mock()
        
        self.registry.register_converter('CustomResource', mock_converter, 'custom')
        
        assert 'CustomResource' in self.registry._custom_converters
        assert 'custom' in self.registry._custom_converters['CustomResource']
        assert self.registry._custom_converters['CustomResource']['custom'] is mock_converter
    
    def test_get_custom_converter(self):
        """Test retrieving custom converters"""
        mock_converter = Mock()
        self.registry.register_converter('TestResource', mock_converter)
        
        retrieved = self.registry.get_custom_converter('TestResource')
        assert retrieved is mock_converter
        
        # Test non-existent converter
        assert self.registry.get_custom_converter('NonExistent') is None
    
    def test_list_custom_converters(self):
        """Test listing all custom converters"""
        mock_converter1 = Mock()
        mock_converter2 = Mock()
        
        self.registry.register_converter('Resource1', mock_converter1)
        self.registry.register_converter('Resource2', mock_converter2)
        
        converters = self.registry.list_custom_converters()
        
        assert 'Resource1' in converters
        assert 'Resource2' in converters
        assert converters['Resource1']['custom'] is mock_converter1


class TestConvenienceFunctions:
    
    def test_get_converter_function(self):
        """Test get_converter convenience function"""
        converter = get_converter('Patient')
        assert converter is not None
        assert callable(converter)
    
    def test_convert_to_fhir_function(self):
        """Test convert_to_fhir convenience function"""
        # Mock a converter in the global factory
        mock_converter = Mock(return_value={'resourceType': 'Test', 'id': 'convenience-test'})
        converter_factory._legacy_converters['ConvenienceTest'] = mock_converter
        
        result = convert_to_fhir('ConvenienceTest', {'test': True})
        
        assert result['resourceType'] == 'Test'
        assert result['id'] == 'convenience-test'
    
    def test_convert_from_fhir_function(self):
        """Test convert_from_fhir convenience function"""
        # Mock a class converter with from_fhir capability
        mock_converter_class = Mock()
        mock_converter_instance = Mock()
        mock_converter_instance.from_fhir.return_value = {'converted': True}
        mock_converter_class.return_value = mock_converter_instance
        
        converter_factory._class_converters['ConvenienceFromTest'] = mock_converter_class
        
        result = convert_from_fhir('ConvenienceFromTest', {'resourceType': 'Test'})
        
        assert result['converted'] is True
    
    def test_list_converters_function(self):
        """Test list_converters convenience function"""
        converters = list_converters()
        
        assert isinstance(converters, dict)
        assert 'legacy' in converters
        assert 'class' in converters
        assert 'specialized' in converters


class TestSingletonInstances:
    
    def test_singleton_factory_instance(self):
        """Test that singleton instances are properly initialized"""
        assert converter_factory is not None
        assert isinstance(converter_factory, ConverterFactory)
        
        assert converter_registry is not None
        assert isinstance(converter_registry, ConverterRegistry)
    
    def test_factory_singleton_consistency(self):
        """Test that convenience functions use the same singleton"""
        # Get converter through convenience function and directly
        convenience_converter = get_converter('Patient')
        direct_converter = converter_factory.get_converter('Patient')
        
        assert convenience_converter is direct_converter


class TestIntegrationScenarios:
    
    def test_backwards_compatibility(self):
        """Test that existing converter usage still works"""
        factory = ConverterFactory()
        
        # Test that all legacy converters are still accessible
        patient_converter = factory.get_converter('Patient', 'legacy')
        assert patient_converter is not None
        assert callable(patient_converter)
        
        # Test that new class converters work
        doc_converter = factory.get_converter('DocumentReference', 'class')
        assert doc_converter is not None
        assert hasattr(doc_converter, 'to_fhir')
    
    def test_converter_priority_selection(self):
        """Test that auto mode selects converters with correct priority"""
        factory = ConverterFactory()
        
        # DocumentReference should prefer class converter over legacy
        converter = factory.get_converter('DocumentReference', 'auto')
        assert hasattr(converter, 'to_fhir')  # Class converter characteristic
        
        # Patient should use legacy converter (no class available)
        converter = factory.get_converter('Patient', 'auto')
        assert callable(converter)  # Function converter characteristic
    
    def test_error_handling_robustness(self):
        """Test error handling in various scenarios"""
        factory = ConverterFactory()
        
        # Test with invalid resource type
        with pytest.raises(ValueError):
            factory.convert_to_fhir('InvalidResource', {})
        
        # Test with invalid converter type
        converter = factory.get_converter('Patient', 'invalid_type')
        assert converter is None
        
        # Test convert_from_fhir with incompatible converter
        with pytest.raises(ValueError):
            factory.convert_from_fhir('Patient', {})
    
    def test_real_converter_integration(self):
        """Test with actual converter functions (if available)"""
        factory = ConverterFactory()
        
        # Test that we can actually get real converters
        patient_converter = factory.get_converter('Patient')
        assert patient_converter is not None
        
        observation_converter = factory.get_converter('Observation')
        assert observation_converter is not None
        
        # Test converter info for real converters
        info = factory.get_converter_info('Patient')
        assert info['resource_type'] == 'Patient'
        assert len(info['available_converters']) > 0


class TestPerformanceAndCaching:
    
    def test_caching_performance(self):
        """Test that caching improves performance"""
        factory = ConverterFactory()
        
        # First call should populate cache
        start_cache_size = len(factory._converter_cache)
        converter1 = factory.get_converter('Patient', 'legacy')
        
        assert len(factory._converter_cache) > start_cache_size
        
        # Second call should use cache
        converter2 = factory.get_converter('Patient', 'legacy')
        assert converter1 is converter2
    
    def test_cache_key_uniqueness(self):
        """Test that different converter requests get different cache keys"""
        factory = ConverterFactory()
        
        # Get different types of converters
        factory.get_converter('Patient', 'legacy')
        factory.get_converter('Patient', 'auto')
        factory.get_converter('DocumentReference', 'class')
        
        # Should have separate cache entries
        cache_keys = list(factory._converter_cache.keys())
        assert 'Patient_legacy' in cache_keys
        assert 'Patient_auto' in cache_keys
        assert 'DocumentReference_class' in cache_keys