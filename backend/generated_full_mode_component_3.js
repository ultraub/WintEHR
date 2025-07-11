import React, { useMemo } from 'react';
import { Box, Card, CardContent, Typography, CircularProgress, Alert } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePatientResources } from '../../../hooks/useFHIRResources';
import { usePatientContext } from '../../../contexts/PatientContext';

const RiskAssessmentChart = () => {
  const { patientId } = usePatientContext();

  // Fetch risk assessments
  const { resources: riskAssessments, loading, error } = usePatientResources(
    patientId,
    'RiskAssessment',
    {
      params: {
        'type': 'stroke-risk',
        '_include': 'RiskAssessment:condition',
        '_sort': '-date',
      },
      enabled: !!patientId
    }
  );

  // Process risk assessment data
  const chartData = useMemo(() => {
    if (!riskAssessments?.length) return [];

    const riskLevelCounts = riskAssessments
      .filter(risk => {
        // Filter for hypertension-related risks
        const conditions = risk.basis?.filter(ref => 
          ref.reference?.includes('Condition')
        );
        return conditions?.some(condition =>
          condition.code?.coding?.some(code => 
            code.code === '38341003' // SNOMED CT code for hypertension
          )
        );
      })
      .reduce((acc, risk) => {
        const riskLevel = risk.prediction?.[0]?.qualitativeRisk?.coding?.[0]?.display || 'Unknown';
        acc[riskLevel] = (acc[riskLevel] || 0) + 1;
        return acc;
      }, {});

    return Object.entries(riskLevelCounts).map(([level, count]) => ({
      riskLevel: level,
      count: count
    }));
  }, [riskAssessments]);

  if (error) {
    return (
      <Alert severity="error">
        Error loading risk assessment data: {error.message}
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Stroke Risk Assessment Distribution
        </Typography>

        {loading ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        ) : !chartData.length ? (
          <Alert severity="info">
            No stroke risk assessments found for this patient
          </Alert>
        ) : (
          <Box height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="riskLevel"
                  label={{ value: 'Risk Level', position: 'bottom' }}
                />
                <YAxis
                  label={{ 
                    value: 'Number of Assessments',
                    angle: -90,
                    position: 'insideLeft'
                  }}
                />
                <Tooltip />
                <Bar
                  dataKey="count"
                  fill="#2196f3"
                  name="Number of Assessments"
                />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default RiskAssessmentChart;