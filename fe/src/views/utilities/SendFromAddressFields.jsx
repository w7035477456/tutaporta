import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import PropTypes from 'prop-types';

export default function SendFromAddressFields({ form, onChange, themedFieldSx }) {
  const set = (key) => (e) => onChange({ ...form, [key]: e.target.value });

  return (
    <Box
      sx={{
        border: '2px solid #ffd400',
        borderRadius: 1,
        p: 1.25,
        backgroundColor: '#fff9cc'
      }}
    >
      <Typography sx={{ color: 'var(--theme-primary-color)', fontWeight: 700, mb: 1 }}>Send From Address</Typography>
      <Stack spacing={1}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField label="First Name" value={form.firstName} onChange={set('firstName')} fullWidth sx={themedFieldSx} />
          <TextField label="Last Name" value={form.lastName} onChange={set('lastName')} fullWidth sx={themedFieldSx} />
          <TextField label="Email" value={form.email} onChange={set('email')} fullWidth sx={themedFieldSx} />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField label="Phone" value={form.phone} onChange={set('phone')} fullWidth sx={themedFieldSx} />
          <TextField label="Street" value={form.street} onChange={set('street')} fullWidth sx={themedFieldSx} />
          <TextField label="City" value={form.city} onChange={set('city')} fullWidth sx={themedFieldSx} />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField label="Zip" value={form.zip} onChange={set('zip')} fullWidth sx={themedFieldSx} />
          <TextField label="Country" value={form.country} onChange={set('country')} fullWidth sx={themedFieldSx} />
        </Stack>
      </Stack>
    </Box>
  );
}

SendFromAddressFields.propTypes = {
  form: PropTypes.shape({
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    email: PropTypes.string,
    phone: PropTypes.string,
    street: PropTypes.string,
    city: PropTypes.string,
    zip: PropTypes.string,
    country: PropTypes.string
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  themedFieldSx: PropTypes.object
};
