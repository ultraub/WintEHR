/**
 * Enhanced Interaction Components for Clinical Workspace
 * Provides hover effects, ripples, tooltips, and micro-interactions
 */
import React, { useState, useRef } from 'react';
import {
  Box,
  IconButton,
  Button,
  Tooltip,
  Zoom,
  Grow,
  Collapse,
  Typography,
  useTheme,
  alpha,
  Chip,
  Badge,
  ButtonBase
} from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon
} from '@mui/icons-material';
import { 
  getHoverEffect, 
  getSmoothTransition,
  getBorderRadius 
} from '../../../../../themes/clinicalThemeUtils';

/**
 * Enhanced IconButton with ripple and hover effects
 */
export const InteractiveIconButton = ({ 
  children, 
  onClick, 
  size = 'medium',
  color = 'default',
  tooltip,
  hoverEffect = 'scale',
  disabled = false,
  sx = {},
  ...props 
}) => {
  const theme = useTheme();
  const [isPressed, setIsPressed] = useState(false);
  
  const button = (
    <IconButton
      onClick={onClick}
      size={size}
      color={color}
      disabled={disabled}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      sx={{
        ...getHoverEffect(hoverEffect, theme),
        transform: isPressed ? 'scale(0.95)' : 'scale(1)',
        ...getSmoothTransition(['transform', 'box-shadow']),
        ...sx
      }}
      {...props}
    >
      {children}
    </IconButton>
  );
  
  return tooltip ? (
    <Tooltip 
      title={tooltip} 
      placement="top"
      TransitionComponent={Zoom}
      enterDelay={500}
    >
      <span>{button}</span>
    </Tooltip>
  ) : button;
};

/**
 * Enhanced Button with gradient hover and ripple
 */
export const InteractiveButton = ({ 
  children, 
  onClick, 
  variant = 'contained',
  color = 'primary',
  size = 'medium',
  startIcon,
  endIcon,
  tooltip,
  hoverEffect = 'lift',
  disabled = false,
  sx = {},
  ...props 
}) => {
  const theme = useTheme();
  
  const button = (
    <Button
      onClick={onClick}
      variant={variant}
      color={color}
      size={size}
      startIcon={startIcon}
      endIcon={endIcon}
      disabled={disabled}
      sx={{
        borderRadius: getBorderRadius('md'),
        textTransform: 'none',
        fontWeight: 600,
        ...getHoverEffect(hoverEffect, theme),
        ...sx
      }}
      {...props}
    >
      {children}
    </Button>
  );
  
  return tooltip ? (
    <Tooltip 
      title={tooltip} 
      placement="top"
      TransitionComponent={Zoom}
      enterDelay={500}
    >
      <span>{button}</span>
    </Tooltip>
  ) : button;
};

/**
 * Expandable section with smooth animations
 */
export const ExpandableSection = ({ 
  title, 
  children, 
  defaultExpanded = true,
  icon,
  badge,
  onToggle,
  headerSx = {},
  contentSx = {},
  disabled = false 
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const theme = useTheme();
  
  const handleToggle = () => {
    if (disabled) return;
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    onToggle?.(newExpanded);
  };
  
  return (
    <Box>
      <ButtonBase
        onClick={handleToggle}
        disabled={disabled}
        sx={{
          width: '100%',
          p: 1,
          borderRadius: getBorderRadius('sm'),
          justifyContent: 'flex-start',
          ...getHoverEffect('darken', theme),
          cursor: disabled ? 'default' : 'pointer',
          ...headerSx
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
          {icon && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {icon}
            </Box>
          )}
          <Typography variant="h6" sx={{ fontWeight: 600, flex: 1, textAlign: 'left' }}>
            {title}
          </Typography>
          {badge && (
            <Badge 
              badgeContent={badge} 
              color="primary"
              sx={{
                '& .MuiBadge-badge': {
                  borderRadius: 0,
                  fontWeight: 600
                }
              }}
            />
          )}
          <Box
            sx={{
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              ...getSmoothTransition(['transform'])
            }}
          >
            <ExpandIcon />
          </Box>
        </Box>
      </ButtonBase>
      
      <Collapse 
        in={expanded} 
        timeout={300}
        easing={{
          enter: theme.transitions.easing.easeOut,
          exit: theme.transitions.easing.sharp
        }}
      >
        <Box sx={{ pt: 1, ...contentSx }}>
          {children}
        </Box>
      </Collapse>
    </Box>
  );
};

/**
 * Tooltip with rich content and enhanced styling
 */
export const RichTooltip = ({ 
  title, 
  content, 
  children, 
  placement = 'top',
  maxWidth = 300,
  showDelay = 500 
}) => {
  const theme = useTheme();
  
  const tooltipContent = (
    <Box sx={{ p: 1 }}>
      {title && (
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
          {title}
        </Typography>
      )}
      {typeof content === 'string' ? (
        <Typography variant="body2" sx={{ color: 'inherit' }}>
          {content}
        </Typography>
      ) : content}
    </Box>
  );
  
  return (
    <Tooltip
      title={tooltipContent}
      placement={placement}
      enterDelay={showDelay}
      TransitionComponent={Zoom}
      componentsProps={{
        tooltip: {
          sx: {
            maxWidth,
            backgroundColor: theme.palette.mode === 'dark' 
              ? alpha(theme.palette.grey[900], 0.95)
              : alpha(theme.palette.grey[800], 0.95),
            backdropFilter: 'blur(8px)',
            border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
            borderRadius: getBorderRadius('md'),
            boxShadow: theme.shadows[8]
          }
        }
      }}
    >
      <span>{children}</span>
    </Tooltip>
  );
};

/**
 * Copy to clipboard button with feedback
 */
export const CopyButton = ({ 
  text, 
  tooltip = "Copy to clipboard",
  size = 'small',
  variant = 'outlined' 
}) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };
  
  return (
    <InteractiveIconButton
      onClick={handleCopy}
      size={size}
      tooltip={copied ? "Copied!" : tooltip}
      color={copied ? 'success' : 'default'}
      hoverEffect="scale"
    >
      {copied ? <CheckIcon fontSize="small" /> : <CopyIcon fontSize="small" />}
    </InteractiveIconButton>
  );
};

/**
 * Animated chip with hover effects
 */
export const InteractiveChip = ({ 
  label, 
  color = 'default',
  variant = 'filled',
  icon,
  onDelete,
  onClick,
  tooltip,
  hoverEffect = 'lift',
  sx = {},
  ...props 
}) => {
  const theme = useTheme();
  
  const chip = (
    <Chip
      label={label}
      color={color}
      variant={variant}
      icon={icon}
      onDelete={onDelete}
      onClick={onClick}
      sx={{
        borderRadius: 0,
        fontWeight: 600,
        ...getHoverEffect(hoverEffect, theme),
        ...sx
      }}
      {...props}
    />
  );
  
  return tooltip ? (
    <Tooltip title={tooltip} placement="top" TransitionComponent={Zoom}>
      <span>{chip}</span>
    </Tooltip>
  ) : chip;
};

/**
 * Hover card with smooth transitions
 */
export const HoverCard = ({ 
  children, 
  elevation = 1,
  hoverElevation = 3,
  hoverEffect = 'lift',
  onClick,
  sx = {},
  ...props 
}) => {
  const theme = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <Box
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        borderRadius: 0,
        boxShadow: theme.shadows[isHovered ? hoverElevation : elevation],
        ...getHoverEffect(hoverEffect, theme),
        ...sx
      }}
      {...props}
    >
      {children}
    </Box>
  );
};

/**
 * Animated counter with smooth number transitions
 */
export const AnimatedCounter = ({ 
  value, 
  duration = 1000,
  formatter,
  variant = 'h4',
  color = 'text.primary',
  ...props 
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const animationRef = useRef(null);
  
  React.useEffect(() => {
    if (animationRef.current) {
      clearInterval(animationRef.current);
    }
    
    const startValue = displayValue;
    const endValue = value;
    const increment = (endValue - startValue) / (duration / 16); // 60fps
    
    animationRef.current = setInterval(() => {
      setDisplayValue(current => {
        const next = current + increment;
        if ((increment > 0 && next >= endValue) || (increment < 0 && next <= endValue)) {
          clearInterval(animationRef.current);
          return endValue;
        }
        return next;
      });
    }, 16);
    
    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, [value, duration]);
  
  const formattedValue = formatter ? formatter(displayValue) : Math.round(displayValue);
  
  return (
    <Typography 
      variant={variant} 
      color={color}
      sx={{ 
        fontWeight: 'bold',
        ...getSmoothTransition(['color'])
      }}
      {...props}
    >
      {formattedValue}
    </Typography>
  );
};

export default {
  InteractiveIconButton,
  InteractiveButton,
  ExpandableSection,
  RichTooltip,
  CopyButton,
  InteractiveChip,
  HoverCard,
  AnimatedCounter
};