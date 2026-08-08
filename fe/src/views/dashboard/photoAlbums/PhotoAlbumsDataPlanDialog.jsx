import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import api from 'api/axios';
import { getPayPalCheckoutConfig } from 'api/paypalConfigFe';
import { purchasePhotoAlbumsRefill } from 'api/photoAlbumsFe';
import { getPricePerTokenFromEnv } from 'config/pricePerTokenEnv';
import { PROFILES_RECORDS_PATH } from 'constants/profilesRecordsRoute';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import EarnTokensButton from 'ui-component/EarnTokensButton';
import GreenButton from 'ui-component/GreenButton';
import { getPhotoAlbumsOverageThrottleActive } from 'utils/photoAlbumsOverageThrottleUi';
import { dismissPhotoAlbumsTrafficWait } from 'utils/photoAlbumsTrafficWaitGate';
import EarnTokensPopup from 'views/utilities/EarnTokensPopup';

function formatTokenPriceDollar(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) return '$0';
  if (Math.abs(n - Math.round(n)) < 0.001) return `$${Math.round(n)}`;
  return `$${n.toFixed(2)}`;
}

const DEFAULT_GB_PER_TOKEN = 10;
const TOKEN_PURCHASE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function formatDataMb(mb) {
  const value = Number(mb) || 0;
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1024) {
    const gb = abs / 1024;
    return `${sign}${gb.toFixed(3)}GB`;
  }
  return `${sign}${abs.toFixed(1)}MB`;
}

function InfoLine({ label, children }) {
  return (
    <Typography component="div" sx={{ fontWeight: 700, lineHeight: 1.45 }}>
      <Box component="span" sx={{ fontWeight: 800 }}>
        • {label}:
      </Box>{' '}
      {children}
    </Typography>
  );
}

InfoLine.propTypes = {
  label: PropTypes.string.isRequired,
  children: PropTypes.node
};

const planSectionBoxSx = {
  border: '1px solid #000',
  borderRadius: 1,
  px: 1.5,
  py: 1.1,
  bgcolor: 'rgba(255,255,255,0.35)'
};

function PlanSectionBox({ title, children }) {
  return (
    <Box sx={planSectionBoxSx}>
      <Typography sx={{ fontWeight: 800, mb: 0.6 }}>{title}</Typography>
      {children}
    </Box>
  );
}

PlanSectionBox.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node
};

export default function PhotoAlbumsDataPlanDialog({
  open,
  usage,
  onClose,
  onPurchased,
  onGetMoreTokens
}) {
  const navigate = useNavigate();
  const [tokens, setTokens] = useState('2');
  const [tokenBalance, setTokenBalance] = useState(0);
  const [remainMb, setRemainMb] = useState(0);
  const [boughtMb, setBoughtMb] = useState(0);
  const [pricePerToken, setPricePerToken] = useState(() => getPricePerTokenFromEnv());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  /** GB purchased in the last successful Get Data — opens congratulations confirm. */
  const [purchaseSuccessGb, setPurchaseSuccessGb] = useState(null);
  const [earnOpen, setEarnOpen] = useState(false);

  const gbPerToken = Math.max(
    1,
    Math.round((Number(usage?.transfer?.refillBlockMb) || DEFAULT_GB_PER_TOKEN * 1024) / 1024)
  );
  const tokenCount = Math.max(0, Math.trunc(Number(tokens) || 0));
  const totalGb = tokenCount * gbPerToken;
  const purchasePrice = tokenCount * pricePerToken;
  const newTokenBalance = tokenBalance - tokenCount;
  const purchasedMb = totalGb * 1024;
  const usedMb = Number(usage?.transfer?.usedMb) || 0;
  // Live refill balance (may be negative when over-quota). Do not derive as purchased − used.
  const displayRemainMb = Number.isFinite(Number(remainMb)) ? Number(remainMb) : 0;
  const displayBoughtMb = Number.isFinite(Number(boughtMb)) ? Number(boughtMb) : 0;
  const purchasedTokenEstimate = Math.max(
    0,
    Math.round(displayBoughtMb / Math.max(1, gbPerToken * 1024))
  );
  const purchasedTokenLabel =
    purchasedTokenEstimate === 1 ? '1 token' : `${purchasedTokenEstimate} tokens`;
  // Preview of singles.refill_bought_mb after this purchase:
  // remain <= 0 → buy only; remain > 0 → remain + buy.
  const dataAfterPurchaseMb =
    displayRemainMb > 0 ? displayRemainMb + purchasedMb : purchasedMb;
  const canPurchase = !saving && !loading && tokenCount >= 1 && tokenBalance >= tokenCount;

  // Only clear the congrats popup when Data Plans closes — not when usage refreshes after buy.
  // Earn Tokens closes Data Plans then keeps its own popup open — do not clear earnOpen here.
  useEffect(() => {
    if (!open) setPurchaseSuccessGb(null);
  }, [open]);

  // Sync usage counters from parent (may update after purchase without dismissing congrats).
  useEffect(() => {
    if (!open) return;
    const rawRemain =
      usage?.transfer?.refillRemainMbExact ??
      usage?.transfer?.refillRemainMb ??
      usage?.transfer?.leftMb;
    const parsedRemain = Number(rawRemain);
    setRemainMb(Number.isFinite(parsedRemain) ? parsedRemain : 0);
    const rawBought = usage?.transfer?.refillBoughtMb;
    const parsedBought = Number(rawBought);
    setBoughtMb(
      Number.isFinite(parsedBought) && parsedBought >= 0
        ? parsedBought
        : Number(usage?.transfer?.refillBlockMb) || DEFAULT_GB_PER_TOKEN * 1024
    );
  }, [
    open,
    usage?.transfer?.leftMb,
    usage?.transfer?.refillRemainMb,
    usage?.transfer?.refillRemainMbExact,
    usage?.transfer?.refillBoughtMb,
    usage?.transfer?.refillBlockMb
  ]);

  // Load token balance / price once when the dialog opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      api.get('/api/settings/profile'),
      getPayPalCheckoutConfig().catch(() => null)
    ])
      .then(([profileResponse, checkoutConfig]) => {
        if (cancelled) return;
        setTokenBalance(Math.max(0, Math.trunc(Number(profileResponse?.data?.token_balance) || 0)));
        const configuredPrice = Number(checkoutConfig?.paymentPricePerToken);
        if (Number.isFinite(configuredPrice) && configuredPrice > 0) {
          setPricePerToken(configuredPrice);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.error || err?.message || 'Unable to load data plan details');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const openPayPalTokens = () => {
    onClose?.();
    if (onGetMoreTokens) {
      onGetMoreTokens(Math.max(1, tokenCount || 1));
      return;
    }
    navigate(PROFILES_RECORDS_PATH, {
      state: {
        openTab: 'buyTokens',
        tokensBuying: String(Math.max(1, tokenCount || 1))
      }
    });
  };

  const purchaseData = async () => {
    if (saving) return;
    if (tokenCount < 1) {
      setError('Enter at least 1 token.');
      return;
    }
    if (tokenCount > tokenBalance) {
      setError(`You only have ${tokenBalance} token${tokenBalance === 1 ? '' : 's'}.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await purchasePhotoAlbumsRefill(tokenCount);
      setTokenBalance(Number(result?.token_balance) || 0);
      setRemainMb(Number(result?.refill_remain_mb) || 0);
      if (result?.refill_bought_mb != null) {
        setBoughtMb(Number(result.refill_bought_mb) || 0);
      } else {
        const added = Number(result?.refill_added_mb) || purchasedMb;
        setBoughtMb(displayRemainMb > 0 ? displayRemainMb + added : added);
      }
      setPurchaseSuccessGb(totalGb);
      await onPurchased?.(result);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Unable to purchase data');
    } finally {
      setSaving(false);
    }
  };

  const closePurchaseSuccess = () => {
    const remainPositive = Number(remainMb) > 0;
    setPurchaseSuccessGb(null);
    onClose?.();
    // After Get Data → OK: if Data Remain is positive, skip the free-tier queue popup.
    if (remainPositive) {
      dismissPhotoAlbumsTrafficWait();
      return;
    }
    // Brief poll in case usage refresh clears overage right after OK.
    let tries = 0;
    const pollId = window.setInterval(() => {
      tries += 1;
      if (!getPhotoAlbumsOverageThrottleActive()) {
        dismissPhotoAlbumsTrafficWait();
        window.clearInterval(pollId);
        return;
      }
      if (tries >= 15) window.clearInterval(pollId);
    }, 200);
  };

  return (
    <>
    <ColorTemplate16PopupCenterWide
      open={open}
      onClose={saving ? undefined : onClose}
      closeOnBackdrop={false}
      bodyTextAlignLeft={false}
      centeredLeadLines={0}
      overlaySx={{ zIndex: 21000 }}
      cardSx={{
        // Hide the floating scrollbar thumb on the Data Plans panel.
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        '&::-webkit-scrollbar': {
          display: 'none',
          width: 0,
          height: 0
        }
      }}
    >
      <ColorTemplate16PopupCenterWide.Title>Data Plans</ColorTemplate16PopupCenterWide.Title>
      <ColorTemplate16PopupCenterWide.Body spacing={1.2} sx={{ textAlign: 'left' }}>
        <Typography sx={{ lineHeight: 1.5 }}>
          Our data plans are flexible and commitment-free. There are no recurring fees or expiration
          dates—you simply purchase {gbPerToken}GB blocks of Tx/Rx data to use whenever you need them.
          Your data balance carries forward until used. If it reaches zero, transfers continue at
          reduced speed until you refill.
        </Typography>

        <PlanSectionBox title="Your Current Usage">
          <InfoLine label="Purchased data">
            {formatDataMb(displayBoughtMb)} ({purchasedTokenLabel})
          </InfoLine>
          <InfoLine label="Used total">{formatDataMb(usedMb)}</InfoLine>
          <InfoLine label="Remaining">{formatDataMb(displayRemainMb)}</InfoLine>
        </PlanSectionBox>

        <PlanSectionBox title="Your balance">
          <InfoLine label="Price">
            1 token per {gbPerToken}GB block ({formatTokenPriceDollar(pricePerToken)} per token, cost{' '}
            {formatTokenPriceDollar(pricePerToken)} per {gbPerToken}GB)
          </InfoLine>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexWrap: 'wrap',
              fontWeight: 700,
              lineHeight: 1.45
            }}
          >
            <Typography component="span" sx={{ fontWeight: 800 }}>
              • Your Balance:
            </Typography>
            <Box
              component="span"
              sx={{
                display: 'inline-block',
                px: 0.9,
                py: 0.15,
                borderRadius: 999,
                bgcolor: 'var(--theme-yellow-color)',
                color: '#000',
                WebkitTextFillColor: '#000',
                fontWeight: 800
              }}
            >
              {tokenBalance} token{tokenBalance === 1 ? '' : 's'}
            </Box>
            <GreenButton onClick={openPayPalTokens} disabled={saving}>
              Get Tokens
            </GreenButton>
            <EarnTokensButton
              onClick={() => {
                setEarnOpen(true);
                onClose?.();
              }}
              disabled={saving}
            />
          </Box>
        </PlanSectionBox>

        <PlanSectionBox title="Plan purchase">
          <Stack spacing={1}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                flexWrap: 'nowrap',
                whiteSpace: 'nowrap'
              }}
            >
              <Typography sx={{ fontWeight: 700, flexShrink: 0 }}>Purchase</Typography>
              <Select
                size="small"
                value={String(Math.min(10, Math.max(1, tokenCount || 2)))}
                onChange={(event) => setTokens(String(event.target.value))}
                disabled={saving}
                displayEmpty
                renderValue={(selected) => String(selected || '2')}
                inputProps={{ 'aria-label': 'Tokens to purchase' }}
                sx={{
                  width: 64,
                  minWidth: 64,
                  maxWidth: 64,
                  flex: '0 0 64px',
                  bgcolor: '#fff',
                  color: '#000 !important',
                  fontWeight: 800,
                  // Popup body sets WebkitTextFillColor (inverse-daynight); force black on white field.
                  '& .MuiSelect-select': {
                    py: 0.5,
                    px: 0.75,
                    pr: '28px !important',
                    textAlign: 'center',
                    color: '#000 !important',
                    WebkitTextFillColor: '#000 !important'
                  },
                  '& .MuiSelect-icon': { color: '#000' },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#000'
                  }
                }}
                MenuProps={{
                  disableScrollLock: true,
                  sx: { zIndex: 22000 },
                  PaperProps: {
                    sx: {
                      bgcolor: '#fff',
                      border: '1px solid #000',
                      zIndex: 22000,
                      '& .MuiMenuItem-root': {
                        color: '#000 !important',
                        WebkitTextFillColor: '#000 !important',
                        fontWeight: 700,
                        justifyContent: 'center'
                      }
                    }
                  }
                }}
              >
                {TOKEN_PURCHASE_OPTIONS.map((n) => (
                  <MenuItem key={n} value={String(n)}>
                    {n}
                  </MenuItem>
                ))}
              </Select>
              <Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                token{tokenCount === 1 ? '' : 's'} ({totalGb}GB total) — ${purchasePrice.toFixed(2)}
              </Typography>
            </Box>
            <Box>
              <GreenButton onClick={purchaseData} disabled={!canPurchase}>
                {saving ? 'Getting data…' : 'Get Data'}
              </GreenButton>
            </Box>
            <InfoLine label="Token Balance after Purchase">
              {Math.max(0, newTokenBalance)} Token{Math.max(0, newTokenBalance) === 1 ? '' : 's'}
            </InfoLine>
            <InfoLine label="Data Available After Purchase">
              {formatDataMb(dataAfterPurchaseMb)} (no time limit)
            </InfoLine>
          </Stack>
        </PlanSectionBox>

        {loading ? <Alert severity="info">Loading plan details…</Alert> : null}
        {error ? <Alert severity="error">{error}</Alert> : null}
      </ColorTemplate16PopupCenterWide.Body>
    </ColorTemplate16PopupCenterWide>

    <ColorTemplate16PopupCenterWide
      open={purchaseSuccessGb != null}
      onClose={closePurchaseSuccess}
      closeOnBackdrop={false}
      bodyTextAlignLeft={false}
      centeredLeadLines={0}
      overlaySx={{ zIndex: 23000 }}
    >
      <ColorTemplate16PopupCenterWide.Title>Congratulation</ColorTemplate16PopupCenterWide.Title>
      <ColorTemplate16PopupCenterWide.Body spacing={2} sx={{ textAlign: 'center' }}>
        <ColorTemplate16PopupCenterWide.SectionDescription sx={{ mb: 0, textAlign: 'center' }}>
          Congratulation, you bought {purchaseSuccessGb}GB, and all your requests now process on fastest VIP
          servers.
        </ColorTemplate16PopupCenterWide.SectionDescription>
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 0.5 }}>
          <ColorTemplate16PopupCenterWide.ActionButton type="button" onClick={closePurchaseSuccess}>
            OK
          </ColorTemplate16PopupCenterWide.ActionButton>
        </Box>
      </ColorTemplate16PopupCenterWide.Body>
    </ColorTemplate16PopupCenterWide>
    <EarnTokensPopup open={earnOpen} onClose={() => setEarnOpen(false)} />
    </>
  );
}

PhotoAlbumsDataPlanDialog.propTypes = {
  open: PropTypes.bool,
  usage: PropTypes.object,
  onClose: PropTypes.func,
  onPurchased: PropTypes.func,
  onGetMoreTokens: PropTypes.func
};
