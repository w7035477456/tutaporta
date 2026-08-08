// material-ui
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// project imports
import useConfig from 'hooks/useConfig';
import MainCard from 'ui-component/cards/MainCard';
import {
  ENV_MAIN_FONT_FAMILY,
  MAIN_FONT_OPTIONS,
  ensureMainFontStylesheet,
  findMainFontOptionByStack
} from 'config/mainFontEnv';

// ==============================|| CUSTOMIZATION - FONT FAMILY ||============================== //

export default function FontFamilyPage() {
  const {
    state: { fontFamily },
    setField
  } = useConfig();

  const selectedStack = findMainFontOptionByStack(fontFamily || ENV_MAIN_FONT_FAMILY).stack;

  const handleFontChange = (event) => {
    const option = findMainFontOptionByStack(event.target.value);
    ensureMainFontStylesheet(option);
    setField('fontFamily', option.stack);
  };

  return (
    <Stack sx={{ p: 2, gap: 2.5 }}>
      <Typography variant="h5">FONT STYLE</Typography>
      <RadioGroup aria-label="main-font" name="main-font" value={selectedStack} onChange={handleFontChange}>
        <Grid container spacing={1.25}>
          {MAIN_FONT_OPTIONS.map((item) => (
            <Grid key={item.id} size={12}>
              <MainCard
                content={false}
                sx={{
                  p: 0.75,
                  bgcolor: selectedStack === item.stack ? 'primary.light' : 'grey.50'
                }}
              >
                <MainCard
                  content={false}
                  border
                  sx={{
                    p: 1.75,
                    borderWidth: 1,
                    ...(selectedStack === item.stack && { borderColor: 'primary.main' })
                  }}
                >
                  <FormControlLabel
                    sx={{ width: 1 }}
                    control={<Radio value={item.stack} sx={{ display: 'none' }} />}
                    label={
                      <Typography variant="h5" sx={{ pl: 2, fontFamily: item.stack }}>
                        {item.label}
                      </Typography>
                    }
                  />
                </MainCard>
              </MainCard>
            </Grid>
          ))}
        </Grid>
      </RadioGroup>
    </Stack>
  );
}
