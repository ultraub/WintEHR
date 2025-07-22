/**
 * ClinicalBreadcrumbs Component
 * Context-aware breadcrumb navigation for clinical workspace
 */
import React from 'react';
import {
  Breadcrumbs,
  Link,
  Typography,
  Box,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  useTheme,
  alpha
} from '@mui/material';
import {
  NavigateNext as NavigateNextIcon,
  Home as HomeIcon,
  Person as PatientIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const ClinicalBreadcrumbs = ({
  patient,
  activeModule,
  subContext = null,
  onBookmark,
  bookmarked = false
}) => {
  const theme = useTheme();
  const navigate = useNavigate();

  // Build breadcrumb items
  const breadcrumbItems = [
    {
      label: 'Dashboard',
      icon: HomeIcon,
      path: '/',
      clickable: true
    },
    {
      label: 'Patients',
      path: '/patients',
      clickable: true
    },
    ...(patient ? [{
      label: `${patient.name?.[0]?.given?.[0]} ${patient.name?.[0]?.family}`,
      icon: PatientIcon,
      path: `/clinical/${patient.id}`,
      clickable: true,
      chip: patient.identifier?.[0]?.value
    }] : []),
    ...(activeModule ? [{
      label: activeModule.label,
      icon: activeModule.icon,
      path: null,
      clickable: false,
      current: true
    }] : []),
    ...(subContext ? [{
      label: subContext,
      path: null,
      clickable: false,
      current: true
    }] : [])
  ];

  const handleClick = (path) => {
    if (path) {
      navigate(path);
    }
  };

  return (
    <Box
      sx={{
        py: 1,
        px: 2,
        backgroundColor: alpha(theme.palette.background.paper, 0.8),
        backdropFilter: 'blur(10px)',
        borderBottom: 1,
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}
    >
      <Breadcrumbs
        separator={<NavigateNextIcon fontSize="small" />}
        aria-label="breadcrumb"
        sx={{
          '& .MuiBreadcrumbs-separator': {
            color: theme.palette.text.disabled
          }
        }}
      >
        {breadcrumbItems.map((item, index) => {
          const Icon = item.icon;
          const isLast = index === breadcrumbItems.length - 1;
          
          if (isLast || !item.clickable) {
            return (
              <Stack
                key={index}
                direction="row"
                spacing={1}
                alignItems="center"
              >
                {Icon && (
                  <Icon
                    fontSize="small"
                    sx={{
                      color: item.current
                        ? theme.palette.primary.main
                        : theme.palette.text.secondary
                    }}
                  />
                )}
                <Typography
                  color={item.current ? 'primary' : 'text.primary'}
                  sx={{ fontWeight: item.current ? 600 : 400 }}
                >
                  {item.label}
                </Typography>
                {item.chip && (
                  <Chip
                    label={item.chip}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.75rem',
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main
                    }}
                  />
                )}
              </Stack>
            );
          }

          return (
            <Link
              key={index}
              component="button"
              variant="body2"
              underline="hover"
              color="inherit"
              onClick={() => handleClick(item.path)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                '&:hover': {
                  color: theme.palette.primary.main
                }
              }}
            >
              {Icon && <Icon fontSize="small" />}
              {item.label}
              {item.chip && (
                <Chip
                  label={item.chip}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.75rem',
                    ml: 0.5
                  }}
                />
              )}
            </Link>
          );
        })}
      </Breadcrumbs>

      {/* Bookmark Action */}
      {patient && activeModule && (
        <Tooltip title={bookmarked ? 'Remove bookmark' : 'Bookmark this view'}>
          <IconButton
            size="small"
            onClick={onBookmark}
            sx={{
              color: bookmarked ? theme.palette.warning.main : theme.palette.action.active
            }}
          >
            {bookmarked ? <BookmarkIcon /> : <BookmarkBorderIcon />}
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

export default ClinicalBreadcrumbs;