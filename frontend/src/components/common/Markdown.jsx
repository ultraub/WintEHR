/**
 * Markdown
 * Renders markdown text (CDS Hooks card `detail`, clinical note bodies) with
 * the app's typography instead of showing the raw `**` and `#` characters.
 * Raw HTML in the source is not rendered (react-markdown's default).
 */
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Box, Link, Typography } from '@mui/material';

const heading = (variant) =>
  function MarkdownHeading({ node, ...props }) {
    return <Typography variant={variant} sx={{ fontWeight: 600, mt: 1.5, mb: 0.5 }} {...props} />;
  };

const buildComponents = (variant, color) => ({
  p: ({ node, ...props }) => (
    <Typography variant={variant} color={color} sx={{ mb: 1, '&:last-child': { mb: 0 } }} {...props} />
  ),
  h1: heading('subtitle1'),
  h2: heading('subtitle1'),
  h3: heading('subtitle2'),
  h4: heading('subtitle2'),
  h5: heading('subtitle2'),
  h6: heading('subtitle2'),
  li: ({ node, ...props }) => <Typography component="li" variant={variant} color={color} {...props} />,
  a: ({ node, ...props }) => <Link target="_blank" rel="noopener noreferrer" {...props} />,
});

const Markdown = ({ children, variant = 'body2', color = 'text.primary', sx }) => {
  if (typeof children !== 'string' || !children.trim()) return null;
  return (
    <Box
      sx={{
        '& ul, & ol': { pl: 2.5, my: 0.5 },
        '& > :first-of-type': { mt: 0 },
        overflowWrap: 'anywhere',
        ...sx,
      }}
    >
      <ReactMarkdown components={buildComponents(variant, color)}>{children}</ReactMarkdown>
    </Box>
  );
};

export default Markdown;
