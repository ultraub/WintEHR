/**
 * CommandPalette
 * Cmd/Ctrl+K from anywhere in the shell: jump to a page or open a patient's
 * chart without reaching for the mouse. Mounted once, by LayoutV3.
 *
 * Pages come from the same navigation config the sidebar renders, so a page
 * a module contributes appears here automatically. Patients are searched by
 * name once two characters are typed.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Dialog, Divider, InputBase, List, ListItemButton, ListItemIcon, ListItemText, Typography,
} from '@mui/material';
import { Person as PersonIcon, Search as SearchIcon } from '@mui/icons-material';
import { debounce } from 'lodash';
import { fhirClient } from '../../core/fhir/services/fhirClient';
import { getPatientDetailUrl } from '../../core/navigation/navigationUtils';
import { formatPersonName, formatPatientMrn } from '../../utils/clinicalDisplay';

export const isPaletteShortcut = (event) =>
  (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k';

const matches = (query, ...fields) =>
  fields.some((field) => typeof field === 'string' && field.toLowerCase().includes(query));

const CommandPalette = ({ open, onClose, navigationConfig }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState([]);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const requestSeq = useRef(0);
  const listRef = useRef(null);

  const pages = useMemo(
    () => Object.values(navigationConfig || {}).flatMap((section) =>
      (section.items || []).map((item) => ({ ...item, section: section.title }))),
    [navigationConfig]
  );

  const searchPatients = useMemo(
    () => debounce(async (text) => {
      const seq = ++requestSeq.current;
      try {
        const result = await fhirClient.searchPatients({ name: text, _count: 6 });
        if (seq !== requestSeq.current) return;
        setPatients(result.resources || []);
      } catch (error) {
        if (seq !== requestSeq.current) return;
        setPatients([]);
      } finally {
        if (seq === requestSeq.current) setSearching(false);
      }
    }, 250),
    []
  );

  useEffect(() => () => searchPatients.cancel(), [searchPatients]);

  // Fresh state every time it opens.
  useEffect(() => {
    if (open) {
      setQuery('');
      setPatients([]);
      setSearching(false);
      setActiveIndex(0);
    }
  }, [open]);

  const trimmed = query.trim().toLowerCase();

  const handleQueryChange = (event) => {
    const value = event.target.value;
    setQuery(value);
    setActiveIndex(0);
    const text = value.trim();
    if (text.length < 2) {
      requestSeq.current += 1;
      searchPatients.cancel();
      setPatients([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchPatients(text);
  };

  const results = useMemo(() => {
    const pageResults = pages
      .filter((page) => !trimmed || matches(trimmed, page.text, page.description, page.section))
      .map((page) => ({
        key: `page:${page.path}`,
        group: 'Go to',
        primary: page.text,
        secondary: page.description,
        icon: page.icon,
        run: () => navigate(page.path),
      }));
    const patientResults = patients.map((patient) => ({
      key: `patient:${patient.id}`,
      group: 'Patients',
      primary: formatPersonName(patient, 'family-first'),
      secondary: [`MRN ${formatPatientMrn(patient)}`, patient.birthDate && `DOB ${patient.birthDate}`]
        .filter(Boolean)
        .join(' · '),
      icon: <PersonIcon />,
      // Straight to the chart: /patients/:id/clinical is the workspace route.
      run: () => navigate(`${getPatientDetailUrl(patient.id)}/clinical`),
    }));
    // A typed name is most likely a patient, so patients lead once there are any.
    return trimmed ? [...patientResults, ...pageResults] : pageResults;
  }, [pages, patients, trimmed, navigate]);

  const runResult = (result) => {
    if (!result) return;
    onClose();
    result.run();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      runResult(results[activeIndex]);
    }
  };

  // Keep the keyboard-selected row in view.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex]);

  let lastGroup = null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-label="Command palette"
      PaperProps={{ sx: { position: 'fixed', top: '12vh', m: 0, borderRadius: 1.5 } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.25 }}>
        <SearchIcon sx={{ color: 'text.secondary', mr: 1.5 }} />
        <InputBase
          autoFocus
          fullWidth
          value={query}
          onChange={handleQueryChange}
          onKeyDown={handleKeyDown}
          placeholder="Go to a page or find a patient"
          inputProps={{
            'aria-label': 'Go to a page or find a patient',
            role: 'combobox',
            'aria-expanded': true,
            'aria-controls': 'command-palette-results',
            'aria-autocomplete': 'list',
          }}
        />
        <Typography variant="caption" color="text.disabled" sx={{ ml: 1, whiteSpace: 'nowrap' }}>
          Esc
        </Typography>
      </Box>
      <Divider />
      <List id="command-palette-results" role="listbox" ref={listRef} dense sx={{ maxHeight: '52vh', overflow: 'auto', py: 0.5 }}>
        {results.map((result, index) => {
          const showHeader = result.group !== lastGroup;
          lastGroup = result.group;
          return (
            <React.Fragment key={result.key}>
              {showHeader && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', px: 2, pt: 1, pb: 0.5, fontWeight: 600, letterSpacing: 0.4 }}
                >
                  {result.group}
                </Typography>
              )}
              <ListItemButton
                role="option"
                aria-selected={index === activeIndex}
                data-active={index === activeIndex}
                selected={index === activeIndex}
                onMouseMove={() => setActiveIndex(index)}
                onClick={() => runResult(result)}
                sx={{ mx: 0.5, borderRadius: 1 }}
              >
                <ListItemIcon sx={{ minWidth: 36, '& svg': { fontSize: 20 } }}>{result.icon}</ListItemIcon>
                <ListItemText
                  primary={result.primary}
                  secondary={result.secondary}
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItemButton>
            </React.Fragment>
          );
        })}
        {results.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>
            {searching ? 'Searching…' : `Nothing matches "${query.trim()}"`}
          </Typography>
        )}
      </List>
    </Dialog>
  );
};

export default CommandPalette;
