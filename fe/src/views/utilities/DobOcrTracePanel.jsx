import PropTypes from 'prop-types';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

function stepValue(step) {
  return step?.value ?? step?.dob ?? step?.sex ?? null;
}

function formatStepResult(step) {
  return step?.found ? stepValue(step) : 'not found';
}

function formatSavedDisplayForHeadline(fieldLabel, rawValue) {
  const text = String(rawValue ?? '').trim();
  if (!text || text.toLowerCase() === 'not found') return 'not found';
  if (fieldLabel === 'Gender') {
    if (text === 'M') return 'Male';
    if (text === 'F') return 'Female';
  }
  return text;
}

function formatCompactHeadline(fieldLabel, trace, savedKey, selectedKey) {
  if (trace.allFailed) {
    return `${fieldLabel} not found`;
  }
  const rawSaved = trace[savedKey] ?? trace[selectedKey] ?? stepValue(trace.steps.find((s) => s.key === trace.selectedStep));
  const displayValue = formatSavedDisplayForHeadline(fieldLabel, rawSaved);
  return `${fieldLabel} found, save as ${displayValue}`;
}

/**
 * Shows which OCR step found a driver-license field (or that all steps failed).
 * Visible after Step 3 ID capture and on final verification success.
 */
export default function IdFieldOcrTracePanel({
  trace,
  compact = false,
  fieldLabel = 'Date of Birth',
  dbColumn = 'singles.dl_dob',
  savedKey = 'savedDlDob',
  selectedKey = 'selectedDob'
}) {
  if (!trace?.steps?.length) return null;

  const severity = trace.allFailed ? 'warning' : 'success';
  const savedValue = trace[savedKey] ?? trace[selectedKey];
  const headline = compact
    ? formatCompactHeadline(fieldLabel, trace, savedKey, selectedKey)
    : trace.allFailed
      ? `${fieldLabel}: all OCR steps failed — saved as "not found" in ${dbColumn}`
      : `${fieldLabel} found by step "${trace.selectedStep}" — saved as ${savedValue ?? stepValue(trace.steps.find((s) => s.key === trace.selectedStep))}`;

  return (
    <Alert severity={severity} sx={{ textAlign: 'left' }}>
      <Typography component="div" sx={{ fontWeight: 700, mb: compact ? 0 : 1 }}>
        {headline}
      </Typography>
      {!compact ? (
        <Box component="ul" sx={{ m: 0, pl: 2.25 }}>
          {trace.steps.map((step) => (
            <Box
              component="li"
              key={step.key}
              sx={{
                fontWeight: step.key === trace.selectedStep ? 700 : 400,
                color: step.found ? 'inherit' : undefined
              }}
            >
              {step.label}: {formatStepResult(step)}
              {step.key === trace.selectedStep ? ' ✓ used' : ''}
            </Box>
          ))}
        </Box>
      ) : null}
      {!compact ? (
        <Typography component="div" sx={{ mt: 1, fontSize: '0.85em', opacity: 0.9 }}>
          OCR passes: {trace.ocrPassCount ?? 1}
          {trace.rekognitionLineCount != null ? ` · Rekognition LINE count: ${trace.rekognitionLineCount}` : ''}
          {trace.tesseractLineCount != null && trace.tesseractLineCount > 0
            ? ` · Tesseract LINE count: ${trace.tesseractLineCount}`
            : ''}
          {trace.tesseractEnhancedLineCount != null && trace.tesseractEnhancedLineCount > 0
            ? ` · Tesseract enhanced LINE count: ${trace.tesseractEnhancedLineCount}`
            : ''}
        </Typography>
      ) : null}
    </Alert>
  );
}

const traceStepShape = PropTypes.shape({
  key: PropTypes.string,
  label: PropTypes.string,
  dob: PropTypes.string,
  sex: PropTypes.string,
  value: PropTypes.string,
  found: PropTypes.bool
});

const traceShape = PropTypes.shape({
  steps: PropTypes.arrayOf(traceStepShape),
  selectedStep: PropTypes.string,
  selectedDob: PropTypes.string,
  selectedSex: PropTypes.string,
  savedDlDob: PropTypes.string,
  savedPpDob: PropTypes.string,
  savedDlSex: PropTypes.string,
  savedPpSex: PropTypes.string,
  allFailed: PropTypes.bool,
  enhancedPassRan: PropTypes.bool,
  tesseractPassRan: PropTypes.bool,
  ocrPassCount: PropTypes.number,
  rekognitionLineCount: PropTypes.number,
  tesseractLineCount: PropTypes.number,
  tesseractEnhancedLineCount: PropTypes.number
});

IdFieldOcrTracePanel.propTypes = {
  trace: traceShape,
  compact: PropTypes.bool,
  fieldLabel: PropTypes.string,
  dbColumn: PropTypes.string,
  savedKey: PropTypes.string,
  selectedKey: PropTypes.string
};

export function PpDobOcrTracePanel(props) {
  return (
    <IdFieldOcrTracePanel
      fieldLabel="Date of Birth"
      dbColumn="singles.pp_dob"
      savedKey="savedPpDob"
      selectedKey="selectedDob"
      {...props}
    />
  );
}

PpDobOcrTracePanel.propTypes = {
  trace: traceShape,
  compact: PropTypes.bool
};

export function PpSexOcrTracePanel(props) {
  return (
    <IdFieldOcrTracePanel
      fieldLabel="Gender"
      dbColumn="singles.pp_sex"
      savedKey="savedPpSex"
      selectedKey="selectedSex"
      {...props}
    />
  );
}

PpSexOcrTracePanel.propTypes = {
  trace: traceShape,
  compact: PropTypes.bool
};

export function DobOcrTracePanel(props) {
  return (
    <IdFieldOcrTracePanel
      fieldLabel="Date of Birth"
      dbColumn="singles.dl_dob"
      savedKey="savedDlDob"
      selectedKey="selectedDob"
      {...props}
    />
  );
}

DobOcrTracePanel.propTypes = {
  trace: traceShape,
  compact: PropTypes.bool
};

export function SexOcrTracePanel(props) {
  return (
    <IdFieldOcrTracePanel
      fieldLabel="Gender"
      dbColumn="singles.dl_sex"
      savedKey="savedDlSex"
      selectedKey="selectedSex"
      {...props}
    />
  );
}

SexOcrTracePanel.propTypes = {
  trace: traceShape,
  compact: PropTypes.bool
};

export function logIdFieldOcrTraceToConsole(trace, prefix, savedKey, selectedKey) {
  if (!trace?.steps?.length) return;
  console.group(prefix);
  for (const step of trace.steps) {
    console.log(`${step.label}: ${formatStepResult(step)}${step.key === trace.selectedStep ? ' ← USED' : ''}`);
  }
  console.log(
    savedKey + ':',
    trace[savedKey] ?? (trace.allFailed ? 'not found' : trace[selectedKey])
  );
  console.groupEnd();
}

export function logDobOcrTraceToConsole(trace, prefix = '[rekognition-verify] DOB OCR') {
  logIdFieldOcrTraceToConsole(trace, prefix, 'savedDlDob', 'selectedDob');
}

export function logSexOcrTraceToConsole(trace, prefix = '[rekognition-verify] Sex OCR') {
  logIdFieldOcrTraceToConsole(trace, prefix, 'savedDlSex', 'selectedSex');
}
