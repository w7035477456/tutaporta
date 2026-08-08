import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import ListSubheader from '@mui/material/ListSubheader';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import MainCard from 'ui-component/cards/MainCard';
import api from 'api/axios';
import { fetchRequestedSinglesPoem } from 'api/requestsSentFe';
import { getDesktopButtonFontSizeVw, getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesButtonFontSizeVw, getMobileSinglesTextFontSizeVw } from 'config/singlesMemberCardFontEnv';
import useFriendsThemeBackground from 'hooks/useFriendsThemeBackground';
import { formatAliasWithMemberCode } from 'utils/memberLabel';
import SendFromAddressFields from './SendFromAddressFields';
import {
  buildSendFromAddressPayload,
  EMPTY_SEND_FROM_FORM,
  sendFromFormFromAddress,
  validateSendFromForm
} from './sendFlowerAddressUtils';

const SEND_FLOWER_SEND_TO_PRIVACY_TEXT =
  'Address hidden for privacy. Rest assured, the florist has the complete delivery details.';

export default function SendFlowerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialTargetSinglesId = Number(location.state?.targetSinglesId);
  const hasInitialTarget = Number.isFinite(initialTargetSinglesId) && initialTargetSinglesId > 0;
  const [targetSinglesId, setTargetSinglesId] = useState(hasInitialTarget ? initialTargetSinglesId : null);
  const [recipientOptions, setRecipientOptions] = useState([]);
  const [recipientOptionsLoading, setRecipientOptionsLoading] = useState(false);
  const [recipientOptionsError, setRecipientOptionsError] = useState('');

  const [loading, setLoading] = useState(true);
  const [setupError, setSetupError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [setupData, setSetupData] = useState(null);
  const [productId, setProductId] = useState('');
  const [selectionStep, setSelectionStep] = useState('browse');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [cardMessage, setCardMessage] = useState('');
  const [authNetLoading, setAuthNetLoading] = useState(false);
  const [authNetError, setAuthNetError] = useState('');
  const [authNetConfig, setAuthNetConfig] = useState(null);
  const [acceptScriptReady, setAcceptScriptReady] = useState(false);
  const [occasionFilter, setOccasionFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  const [catalogFilterAnchorEl, setCatalogFilterAnchorEl] = useState(null);
  const [cardForm, setCardForm] = useState({
    cardNumber: '',
    expMonth: '',
    expYear: '',
    cardCode: '',
    zip: ''
  });
  const [sendFromForm, setSendFromForm] = useState(EMPTY_SEND_FROM_FORM);
  const { isDarkTheme, darkThemeActive, pageTextColor, filterTextColor, titleFontSx, friendsBackgroundBoxSx } =
    useFriendsThemeBackground();
  const [selectedPoetryLines, setSelectedPoetryLines] = useState(null);
  const occasionLabelMap = useMemo(
    () => ({
      all: 'Everyday',
      everyday: 'Everyday',
      bestsellers: 'Best Sellers',
      getwell: 'Get Well',
      sympathy: 'Funeral & Sympathy',
      congratulations: 'New Baby',
      thankyou: 'Thank You',
      birthday: 'Birthday',
      anniversary: 'Anniversary',
      love: 'Love & Romance',
      christmas: 'Christmas',
      easter: 'Easter',
      valentines: "Valentine's Day",
      mothersday: "Mother's Day"
    }),
    []
  );
  const productLabelMap = useMemo(
    () => ({
      all: 'All Products',
      centerpieces: 'Centerpieces',
      onesided: 'One Sided Arrangements',
      roses: 'Roses',
      mixed: 'Vase Arrangements',
      plants: 'Plants',
      baskets: 'Fruit Baskets',
      balloons: 'Balloons',
      funeralwreaths: 'Funeral Wreaths'
    }),
    []
  );
  const priceLabelMap = useMemo(
    () => ({
      all: 'All',
      u60: '$0 - $60',
      '60t80': '$60 - $80',
      '80t100': '$80 - $100',
      a100: 'Over $100'
    }),
    []
  );
  const selectedOccasionLabel = occasionLabelMap[occasionFilter] || 'Everyday';
  const selectedProductLabel = productLabelMap[productFilter] || 'All Products';
  const selectedPriceLabel = priceLabelMap[priceFilter] || 'All';
  const selectedTopFilterLabel =
    priceFilter !== 'all' ? selectedPriceLabel : productFilter !== 'all' ? selectedProductLabel : selectedOccasionLabel;
  const themedFieldSx = useMemo(
    () => ({
      '& .MuiInputBase-input': { color: pageTextColor, WebkitTextFillColor: pageTextColor },
      '& .MuiInputLabel-root': { color: pageTextColor },
      '& .MuiInputLabel-root.Mui-focused': { color: pageTextColor },
      '& .MuiFormHelperText-root': { color: pageTextColor },
      '& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline': {
        borderColor: 'var(--theme-inverse-daynight-color)'
      },
      '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: 'var(--theme-inverse-daynight-color)'
      },
      '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: 'var(--theme-inverse-daynight-color)'
      }
    }),
    [pageTextColor]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchRequestedSinglesPoem();
        const lines = Array.isArray(result?.lines)
          ? result.lines
              .map((line) => String(line ?? '').trim())
              .filter(Boolean)
              .slice(0, 4)
          : [];
        if (!cancelled) {
          setSelectedPoetryLines(lines.length === 4 ? lines : []);
        }
      } catch (err) {
        console.error('[SendFlowerPage] poem fetch failed (poems are database-only on the server)', err);
        if (!cancelled) setSelectedPoetryLines([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    async function loadSetup() {
      setLoading(true);
      setSetupError('');
      try {
        const params = {
          occasion: occasionFilter,
          product_type: productFilter,
          price_range: priceFilter
        };
        if (Number.isFinite(targetSinglesId) && targetSinglesId > 0) {
          params.target_singles_id = targetSinglesId;
        }
        const { data } = await api.get('/api/sendFlower/setup', {
          params
        });
        if (!alive) return;
        setSetupData(data);
        setSendFromForm(sendFromFormFromAddress(data?.sender?.send_from_address));
        setCardForm((prev) => ({
          ...prev,
          zip: String(data?.sender?.send_from_address?.zip || prev.zip || '')
        }));
        const firstProductId = Array.isArray(data?.products) && data.products.length ? String(data.products[0].product_id) : '';
        setProductId(firstProductId);
        setSelectionStep('browse');
      } catch (err) {
        if (!alive) return;
        setSetupError(err?.response?.data?.error || err?.message || 'Failed to load flower sending options');
      } finally {
        if (alive) setLoading(false);
      }
    }
    loadSetup();
    return () => {
      alive = false;
    };
  }, [targetSinglesId, occasionFilter, productFilter, priceFilter]);

  useEffect(() => {
    let alive = true;
    async function loadRecipientOptions() {
      if (hasInitialTarget) return;
      setRecipientOptionsLoading(true);
      setRecipientOptionsError('');
      try {
        const { data } = await api.get('/api/allSingles');
        if (!alive) return;
        const nextOptions = Array.isArray(data)
          ? data
              .map((item) => ({
                singles_id: Number(item?.singles_id),
                alias: String(item?.alias || '').trim(),
                prefix: item?.prefix ?? null,
                member_id: item?.member_id ?? null,
                city: String(item?.city || '').trim()
              }))
              .filter((item) => Number.isFinite(item.singles_id) && item.singles_id > 0)
          : [];
        setRecipientOptions(nextOptions);
      } catch (err) {
        if (!alive) return;
        setRecipientOptionsError(err?.response?.data?.error || err?.message || 'Failed to load recipient list');
      } finally {
        if (alive) setRecipientOptionsLoading(false);
      }
    }
    loadRecipientOptions();
    return () => {
      alive = false;
    };
  }, [hasInitialTarget]);

  useEffect(() => {
    let alive = true;
    async function loadAuthorizeNetKey() {
      if (!setupData) return;
      setAuthNetLoading(true);
      setAuthNetError('');
      try {
        const { data } = await api.get('/api/sendFlower/authorizenetKey');
        if (!alive) return;
        setAuthNetConfig(data);
      } catch (err) {
        if (!alive) return;
        setAuthNetError(err?.response?.data?.error || err?.message || 'Failed to load Authorize.Net key');
      } finally {
        if (alive) setAuthNetLoading(false);
      }
    }
    loadAuthorizeNetKey();
    return () => {
      alive = false;
    };
  }, [setupData]);

  useEffect(() => {
    if (!authNetConfig?.authorizenet_url) return undefined;
    const scriptId = 'authorizenet-accept-js';
    const existing = document.getElementById(scriptId);
    if (existing) {
      setAcceptScriptReady(Boolean(window.Accept?.dispatchData));
      const onLoad = () => setAcceptScriptReady(Boolean(window.Accept?.dispatchData));
      existing.addEventListener('load', onLoad);
      return () => existing.removeEventListener('load', onLoad);
    }
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = authNetConfig.authorizenet_url;
    script.async = true;
    script.onload = () => setAcceptScriptReady(Boolean(window.Accept?.dispatchData));
    script.onerror = () => setAuthNetError('Failed to load Authorize.Net script');
    document.body.appendChild(script);
    return undefined;
  }, [authNetConfig?.authorizenet_url]);

  const selectedProduct = useMemo(() => {
    const list = Array.isArray(setupData?.products) ? setupData.products : [];
    return list.find((item) => String(item.product_id) === String(productId)) || null;
  }, [setupData?.products, productId]);

  const browseProducts = useMemo(() => {
    const list = Array.isArray(setupData?.products) ? setupData.products : [];
    return list;
  }, [setupData?.products]);

  const tokenizeCard = () =>
    new Promise((resolve, reject) => {
      if (!authNetConfig?.username || !authNetConfig?.authorizenet_key) {
        reject(new Error('Authorize.Net key is missing'));
        return;
      }
      if (!window.Accept?.dispatchData) {
        reject(new Error('Authorize.Net script is not ready'));
        return;
      }
      const cardNumber = String(cardForm.cardNumber || '').replace(/\s+/g, '');
      const month = String(cardForm.expMonth || '').trim();
      const year = String(cardForm.expYear || '').trim();
      const code = String(cardForm.cardCode || '').trim();
      const zip = String(cardForm.zip || '').trim();
      if (!/^\d{13,19}$/.test(cardNumber)) {
        reject(new Error('Card number is invalid'));
        return;
      }
      if (!/^\d{2}$/.test(month)) {
        reject(new Error('Expiry month must be MM'));
        return;
      }
      if (!/^\d{2,4}$/.test(year)) {
        reject(new Error('Expiry year must be YY or YYYY'));
        return;
      }
      if (!/^\d{3,4}$/.test(code)) {
        reject(new Error('Card code is invalid'));
        return;
      }
      if (!zip) {
        reject(new Error('Billing zip is required'));
        return;
      }
      const fullYear = year.length === 2 ? `20${year}` : year;
      const secureData = {
        authData: {
          apiLoginID: authNetConfig.username,
          clientKey: authNetConfig.authorizenet_key
        },
        cardData: {
          cardNumber,
          month,
          year: fullYear,
          cardCode: code,
          zip
        }
      };
      window.Accept.dispatchData(secureData, (response) => {
        if (response?.messages?.resultCode === 'Ok' && response?.opaqueData?.dataValue) {
          resolve(response.opaqueData.dataValue);
          return;
        }
        const msg =
          response?.messages?.message
            ?.map((m) => m?.text)
            .filter(Boolean)
            .join(' | ') || 'Failed to tokenize card';
        reject(new Error(msg));
      });
    });

  const onPlaceOrder = async () => {
    setSaveError('');
    setSaveSuccess('');
    if (!productId) {
      setSaveError('Please choose a flower product before sending.');
      return;
    }
    if (!Number.isFinite(targetSinglesId) || targetSinglesId < 1) {
      setSaveError('Please choose recipient before sending flower gift.');
      return;
    }
    if (!acceptScriptReady) {
      setSaveError('Authorize.Net is not ready yet. Please wait a moment and try again.');
      return;
    }
    const sendFromError = validateSendFromForm(sendFromForm);
    if (sendFromError) {
      setSaveError(sendFromError);
      return;
    }
    setPlacingOrder(true);
    try {
      const token = await tokenizeCard();
      const payload = {
        target_singles_id: targetSinglesId,
        product_id: productId,
        product_price: selectedProduct?.amount ?? null,
        card_message: cardMessage,
        delivery_date: deliveryDate || null,
        authorizenet_token: token,
        send_from_address: buildSendFromAddressPayload(sendFromForm)
      };
      const { data } = await api.post('/api/sendFlower/placeOrder', payload);
      const orderId = data?.florist_order_id ? ` Florist order: ${data.florist_order_id}.` : '';
      setSaveSuccess(`Flower Gift sent successfully, Thank you.${orderId}`);
    } catch (err) {
      setSaveError(err?.response?.data?.error || err?.message || 'Failed to send flower gift');
    } finally {
      setPlacingOrder(false);
    }
  };

  const onSelectFlower = (nextProductId) => {
    setProductId(String(nextProductId || ''));
  };

  const onConfirmFlower = (nextProductId) => {
    onSelectFlower(nextProductId);
    setSelectionStep('details');
  };

  const onSelectAgain = () => {
    setSelectionStep('browse');
  };
  const catalogFilterMenuOpen = Boolean(catalogFilterAnchorEl);
  const onCatalogFilterPick = (value) => {
    const raw = String(value || '');
    if (!raw) return;
    if (raw.startsWith('occasion:')) {
      setOccasionFilter(raw.slice('occasion:'.length) || 'all');
      setProductFilter('all');
      setPriceFilter('all');
      setCatalogFilterAnchorEl(null);
      return;
    }
    if (raw.startsWith('product:')) {
      setOccasionFilter('all');
      setProductFilter(raw.slice('product:'.length) || 'all');
      setPriceFilter('all');
      setCatalogFilterAnchorEl(null);
      return;
    }
    if (raw.startsWith('price:')) {
      setOccasionFilter('all');
      setProductFilter('all');
      setPriceFilter(raw.slice('price:'.length) || 'all');
      setCatalogFilterAnchorEl(null);
      return;
    }
    if (raw === 'clear-all') {
      setOccasionFilter('all');
      setProductFilter('all');
      setPriceFilter('all');
      setCatalogFilterAnchorEl(null);
    }
  };

  return (
    <MainCard
      title="Vetted Friends"
      headerSX={{
        '& .MuiCardHeader-title': {
          ...titleFontSx,
          lineHeight: 1.2
        }
      }}
    >
      <Box sx={friendsBackgroundBoxSx}>
        {selectedPoetryLines === null ? (
          <Box
            sx={{
              mb: 2,
              minHeight: { xs: 120, sm: 200 },
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <CircularProgress size={28} />
          </Box>
        ) : selectedPoetryLines.length === 4 ? (
          <Box
            sx={{
              mb: 2,
              px: { xs: 1.25, sm: 2 },
              py: { xs: 1.25, sm: 1.5 },
              borderRadius: 1.5,
              backgroundColor: 'transparent',
              minHeight: { xs: 150, sm: 240 },
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}
          >
            {selectedPoetryLines.map((line, idx) => (
              <Typography
                key={`send-flower-poetry-${idx}`}
                sx={{
                  textAlign: 'left',
                  color: isDarkTheme ? 'var(--theme-secondary-color) !important' : 'var(--theme-primary-color) !important',
                  WebkitTextFillColor: isDarkTheme ? 'var(--theme-secondary-color)' : 'var(--theme-primary-color)',
                  opacity: 1,
                  fontFamily: 'Zapfino, "Apple Chancery", "Snell Roundhand", "URW Chancery L", cursive',
                  fontSize: { xs: getMobileSinglesTextFontSizeVw(), sm: getDesktopTextFontSizeVw() },
                  fontWeight: 600,
                  lineHeight: 1.85,
                  mb: 0.35
                }}
              >
                {line}
              </Typography>
            ))}
          </Box>
        ) : (
          <Box sx={{ mb: 2, px: { xs: 1.25, sm: 2 }, py: 2 }}>
            <Typography sx={{ color: 'var(--theme-primary-color)', fontWeight: 600 }}>
              Poem text is served only from the database. None is available yet, or the request failed — add rows to the poems table (see
              be/db/addPoemsTable.sql and seedPoemsVettedFriends.sql).
            </Typography>
          </Box>
        )}

        <Stack spacing={2.2}>
          <Typography sx={{ color: pageTextColor }}>
            Start flower gift from Outgoing Requests. Send-To and Send-From addresses are loaded from the `singles` table by `singles_id`.
          </Typography>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : null}

          {setupError ? <Alert severity="error">{setupError}</Alert> : null}

          {!loading && !setupError && setupData ? (
            <Stack spacing={2}>
              <Typography sx={{ color: pageTextColor }}>
                {selectionStep === 'browse'
                  ? `Loaded ${Number(setupData?.products_count || setupData?.products?.length || 0)} flower choices. Double-click to select and continue next page.`
                  : 'Selected flower shown below. Complete the form and send your flower gift.'}
              </Typography>
              {authNetError ? <Alert severity="error">{authNetError}</Alert> : null}
              {saveError ? <Alert severity="error">{saveError}</Alert> : null}
              {saveSuccess ? (
                <Alert
                  severity="success"
                  sx={{
                    border: '2px solid #2e7d32',
                    borderRadius: 1,
                    fontSize: '2rem',
                    fontWeight: 700,
                    lineHeight: 1.25,
                    '& .MuiAlert-icon': {
                      color: '#2e7d32',
                      alignItems: 'center'
                    },
                    '& .MuiAlert-message': {
                      fontSize: 'inherit',
                      fontWeight: 'inherit',
                      lineHeight: 'inherit'
                    }
                  }}
                >
                  {saveSuccess}
                </Alert>
              ) : null}

              {selectionStep === 'browse' ? (
                <Box
                  sx={{
                    maxHeight: { xs: '67vh', md: '70vh' },
                    overflowY: 'auto',
                    pr: 0.5
                  }}
                >
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mb: 1 }}>
                    <Button
                      variant="outlined"
                      onClick={(e) => setCatalogFilterAnchorEl(e.currentTarget)}
                      sx={{
                        textTransform: 'none',
                        minWidth: { xs: '100%', md: 220 },
                        justifyContent: 'space-between',
                        fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() },
                        bgcolor: darkThemeActive ? '#000' : 'transparent',
                        color: filterTextColor,
                        borderColor: 'var(--theme-inverse-daynight-color)',
                        '&:hover': {
                          bgcolor: darkThemeActive ? '#000' : 'transparent',
                          color: filterTextColor,
                          borderColor: 'var(--theme-inverse-daynight-color)',
                          filter: 'brightness(0.95)'
                        }
                      }}
                    >
                      {selectedTopFilterLabel}
                    </Button>
                  </Stack>
                  <Menu
                    anchorEl={catalogFilterAnchorEl}
                    open={catalogFilterMenuOpen}
                    onClose={() => setCatalogFilterAnchorEl(null)}
                    PaperProps={{
                      sx: {
                        minWidth: 260,
                        maxHeight: 420
                      }
                    }}
                  >
                    <ListSubheader sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}>
                      Occasions
                    </ListSubheader>
                    <MenuItem
                      selected={occasionFilter === 'all' || occasionFilter === 'everyday'}
                      sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}
                      onClick={() => onCatalogFilterPick('occasion:all')}
                    >
                      Everyday
                    </MenuItem>
                    <MenuItem
                      selected={occasionFilter === 'mothersday'}
                      sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}
                      onClick={() => onCatalogFilterPick('occasion:mothersday')}
                    >
                      Mother&apos;s Day
                    </MenuItem>
                    <MenuItem
                      selected={occasionFilter === 'bestsellers'}
                      sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}
                      onClick={() => onCatalogFilterPick('occasion:bestsellers')}
                    >
                      Best Sellers
                    </MenuItem>
                    <MenuItem
                      selected={occasionFilter === 'getwell'}
                      sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}
                      onClick={() => onCatalogFilterPick('occasion:getwell')}
                    >
                      Get Well
                    </MenuItem>
                    <MenuItem
                      selected={occasionFilter === 'sympathy'}
                      sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}
                      onClick={() => onCatalogFilterPick('occasion:sympathy')}
                    >
                      Funeral & Sympathy
                    </MenuItem>
                    <MenuItem
                      selected={occasionFilter === 'congratulations'}
                      sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}
                      onClick={() => onCatalogFilterPick('occasion:congratulations')}
                    >
                      New Baby
                    </MenuItem>
                    <MenuItem
                      selected={occasionFilter === 'thankyou'}
                      sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}
                      onClick={() => onCatalogFilterPick('occasion:thankyou')}
                    >
                      Thank You
                    </MenuItem>
                    <MenuItem
                      selected={occasionFilter === 'birthday'}
                      sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}
                      onClick={() => onCatalogFilterPick('occasion:birthday')}
                    >
                      Birthday
                    </MenuItem>
                    <MenuItem
                      selected={occasionFilter === 'anniversary'}
                      sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}
                      onClick={() => onCatalogFilterPick('occasion:anniversary')}
                    >
                      Anniversary
                    </MenuItem>
                    <MenuItem
                      selected={occasionFilter === 'love'}
                      sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}
                      onClick={() => onCatalogFilterPick('occasion:love')}
                    >
                      Love & Romance
                    </MenuItem>
                    <MenuItem
                      selected={occasionFilter === 'valentines'}
                      sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}
                      onClick={() => onCatalogFilterPick('occasion:valentines')}
                    >
                      Valentine&apos;s Day
                    </MenuItem>
                    <MenuItem
                      selected={occasionFilter === 'easter'}
                      sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}
                      onClick={() => onCatalogFilterPick('occasion:easter')}
                    >
                      Easter
                    </MenuItem>
                    <MenuItem
                      selected={occasionFilter === 'christmas'}
                      sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}
                      onClick={() => onCatalogFilterPick('occasion:christmas')}
                    >
                      Christmas
                    </MenuItem>
                    <ListSubheader sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}>
                      Product Types
                    </ListSubheader>
                    <MenuItem
                      sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}
                      onClick={() => onCatalogFilterPick('product:centerpieces')}
                    >
                      Centerpieces
                    </MenuItem>
                    <MenuItem
                      sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}
                      onClick={() => onCatalogFilterPick('product:onesided')}
                    >
                      One Sided Arrangements
                    </MenuItem>
                    <MenuItem
                      sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}
                      onClick={() => onCatalogFilterPick('product:roses')}
                    >
                      Roses
                    </MenuItem>
                    <MenuItem
                      sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}
                      onClick={() => onCatalogFilterPick('product:mixed')}
                    >
                      Vase Arrangements
                    </MenuItem>
                    <MenuItem
                      sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}
                      onClick={() => onCatalogFilterPick('product:plants')}
                    >
                      Plants
                    </MenuItem>
                    <MenuItem
                      sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}
                      onClick={() => onCatalogFilterPick('product:baskets')}
                    >
                      Fruit Baskets
                    </MenuItem>
                    <MenuItem
                      sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}
                      onClick={() => onCatalogFilterPick('product:balloons')}
                    >
                      Balloons
                    </MenuItem>
                    <MenuItem
                      sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}
                      onClick={() => onCatalogFilterPick('product:funeralwreaths')}
                    >
                      Funeral Wreaths
                    </MenuItem>
                    <ListSubheader sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}>
                      Prices
                    </ListSubheader>
                    <MenuItem
                      sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}
                      onClick={() => onCatalogFilterPick('price:u60')}
                    >
                      Under $60
                    </MenuItem>
                    <MenuItem
                      sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}
                      onClick={() => onCatalogFilterPick('price:60t80')}
                    >
                      Between $60 and $80
                    </MenuItem>
                    <MenuItem
                      sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}
                      onClick={() => onCatalogFilterPick('price:80t100')}
                    >
                      Between $80 and $100
                    </MenuItem>
                    <MenuItem
                      sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}
                      onClick={() => onCatalogFilterPick('price:a100')}
                    >
                      Over $100
                    </MenuItem>
                    <MenuItem
                      sx={{ fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() } }}
                      onClick={() => onCatalogFilterPick('clear-all')}
                    >
                      Clear All Filters
                    </MenuItem>
                  </Menu>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mb: 1.2 }}>
                    {/** /send-flower only: keep top filter row text readable in both themes */}
                    {/** by forcing inverse day/night text color for label, value, and dropdown icon. */}
                    <TextField
                      select
                      label="Occasion"
                      value={occasionFilter}
                      onChange={(e) => {
                        setOccasionFilter(String(e.target.value || 'all'));
                        setProductFilter('all');
                        setPriceFilter('all');
                      }}
                      size="small"
                      sx={{
                        minWidth: { xs: '100%', md: 180 },
                        ...themedFieldSx,
                        '& .MuiInputBase-input': { color: filterTextColor, WebkitTextFillColor: filterTextColor },
                        '& .MuiInputLabel-root': { color: filterTextColor },
                        '& .MuiInputLabel-root.Mui-focused': { color: filterTextColor },
                        '& .MuiSelect-icon': { color: filterTextColor }
                      }}
                    >
                      <MenuItem value="all">All Occasions</MenuItem>
                      <MenuItem value="mothersday">Mother&apos;s Day</MenuItem>
                      <MenuItem value="bestsellers">Best Sellers</MenuItem>
                      <MenuItem value="anniversary">Anniversary</MenuItem>
                      <MenuItem value="birthday">Birthday</MenuItem>
                      <MenuItem value="sympathy">Funeral / Sympathy</MenuItem>
                      <MenuItem value="love">Love</MenuItem>
                      <MenuItem value="getwell">Get Well</MenuItem>
                      <MenuItem value="thankyou">Thank You</MenuItem>
                      <MenuItem value="congratulations">Congratulations</MenuItem>
                      <MenuItem value="valentines">Valentine&apos;s Day</MenuItem>
                      <MenuItem value="easter">Easter</MenuItem>
                      <MenuItem value="christmas">Christmas</MenuItem>
                    </TextField>
                    <TextField
                      select
                      label="By Product"
                      value={productFilter}
                      onChange={(e) => {
                        setOccasionFilter('all');
                        setProductFilter(String(e.target.value || 'all'));
                        setPriceFilter('all');
                      }}
                      size="small"
                      sx={{
                        minWidth: { xs: '100%', md: 180 },
                        ...themedFieldSx,
                        '& .MuiInputBase-input': { color: filterTextColor, WebkitTextFillColor: filterTextColor },
                        '& .MuiInputLabel-root': { color: filterTextColor },
                        '& .MuiInputLabel-root.Mui-focused': { color: filterTextColor },
                        '& .MuiSelect-icon': { color: filterTextColor }
                      }}
                    >
                      <MenuItem value="all">All Products</MenuItem>
                      <MenuItem value="centerpieces">Centerpieces</MenuItem>
                      <MenuItem value="onesided">One Sided Arrangements</MenuItem>
                      <MenuItem value="roses">Roses</MenuItem>
                      <MenuItem value="mixed">Mixed Arrangements</MenuItem>
                      <MenuItem value="plants">Plants</MenuItem>
                      <MenuItem value="baskets">Baskets</MenuItem>
                      <MenuItem value="balloons">Balloons</MenuItem>
                      <MenuItem value="funeralwreaths">Funeral Wreaths</MenuItem>
                    </TextField>
                    <TextField
                      select
                      label="By Price"
                      value={priceFilter}
                      onChange={(e) => {
                        setOccasionFilter('all');
                        setProductFilter('all');
                        setPriceFilter(String(e.target.value || 'all'));
                      }}
                      size="small"
                      sx={{
                        minWidth: { xs: '100%', md: 160 },
                        ...themedFieldSx,
                        '& .MuiInputBase-input': { color: filterTextColor, WebkitTextFillColor: filterTextColor },
                        '& .MuiInputLabel-root': { color: filterTextColor },
                        '& .MuiInputLabel-root.Mui-focused': { color: filterTextColor },
                        '& .MuiSelect-icon': { color: filterTextColor }
                      }}
                    >
                      <MenuItem value="all">All</MenuItem>
                      <MenuItem value="u60">Under $60</MenuItem>
                      <MenuItem value="60t80">$60 - $80</MenuItem>
                      <MenuItem value="80t100">$80 - $100</MenuItem>
                      <MenuItem value="a100">Over $100</MenuItem>
                    </TextField>
                  </Stack>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: 'repeat(1, minmax(0, 1fr))',
                        sm: 'repeat(2, minmax(0, 1fr))',
                        md: 'repeat(3, minmax(0, 1fr))'
                      },
                      gap: 1.25,
                      // In dark theme, make grid gap lines white so row/column separators disappear.
                      backgroundColor: darkThemeActive ? '#fff' : 'transparent',
                      borderRadius: 1
                    }}
                  >
                    {browseProducts.map((item) => {
                      const isSelected = String(productId) === String(item.product_id);
                      return (
                        <Box
                          key={String(item.product_id)}
                          role="button"
                          tabIndex={0}
                          onClick={() => onSelectFlower(item.product_id)}
                          onDoubleClick={() => onConfirmFlower(item.product_id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onSelectFlower(item.product_id);
                            }
                            if (e.key === 'Enter') {
                              onConfirmFlower(item.product_id);
                            }
                          }}
                          sx={{
                            border: 'none',
                            borderRadius: 2,
                            p: 1,
                            backgroundColor: darkThemeActive ? (isSelected ? '#eef5ff' : '#fff') : isSelected ? '#eaf4ff' : 'transparent',
                            cursor: 'pointer',
                            boxShadow: isSelected && !darkThemeActive ? '0 0 0 1px rgba(0,0,0,0.08)' : 'none'
                          }}
                        >
                          {item?.image_url ? (
                            <Box
                              component="img"
                              src={item.image_url}
                              alt={item.title || 'flower product'}
                              sx={{
                                width: '100%',
                                height: 150,
                                borderRadius: 1,
                                objectFit: 'contain',
                                objectPosition: 'center',
                                backgroundColor: '#fff',
                                transform: 'scale(1.12)'
                              }}
                            />
                          ) : null}
                          <Box
                            sx={{
                              mt: 1,
                              px: 0.9,
                              py: 0.55,
                              borderRadius: 1,
                              border: darkThemeActive ? '1px solid #fff' : '1px solid var(--theme-primary-color)',
                              backgroundColor: 'var(--theme-secondary-color)'
                            }}
                          >
                            <Typography
                              sx={{
                                textAlign: 'center',
                                fontWeight: 800,
                                color: 'var(--theme-primary-color)',
                                fontSize: '2.06rem',
                                lineHeight: 1.18
                              }}
                            >
                              {item.title || `Product ${item.product_id}`}
                            </Typography>
                            <Typography
                              sx={{
                                textAlign: 'center',
                                fontWeight: 800,
                                fontSize: '1.96rem',
                                lineHeight: 1.15,
                                color: 'var(--theme-primary-color)'
                              }}
                            >
                              {item.amount != null ? `$${Number(item.amount).toFixed(2)}` : 'Price available at checkout'}
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              ) : (
                <Stack spacing={1.8} sx={{ maxWidth: 860, width: '100%', mx: 'auto' }}>
                  <SendFromAddressFields form={sendFromForm} onChange={setSendFromForm} themedFieldSx={themedFieldSx} />
                  <TextField
                    label="Send To Address"
                    value={SEND_FLOWER_SEND_TO_PRIVACY_TEXT}
                    multiline
                    minRows={2}
                    InputProps={{ readOnly: true }}
                    fullWidth
                    sx={themedFieldSx}
                  />
                  {!hasInitialTarget ? (
                    <Box
                      sx={{
                        border: '2px solid #ffd400',
                        borderRadius: 1,
                        p: 1.25,
                        backgroundColor: '#fff9cc'
                      }}
                    >
                      <Typography sx={{ color: 'var(--theme-primary-color)', fontWeight: 700, mb: 1 }}>Recipient</Typography>
                      <TextField
                        select
                        label="Choose recipient"
                        value={Number.isFinite(targetSinglesId) && targetSinglesId > 0 ? String(targetSinglesId) : ''}
                        onChange={(e) => {
                          const nextId = Number(e.target.value);
                          setTargetSinglesId(Number.isFinite(nextId) && nextId > 0 ? nextId : null);
                        }}
                        fullWidth
                        sx={themedFieldSx}
                      >
                        <MenuItem value="">Select recipient</MenuItem>
                        {recipientOptions.map((item) => (
                          <MenuItem key={item.singles_id} value={String(item.singles_id)}>
                            {`${formatAliasWithMemberCode({
                              alias: item.alias,
                              prefix: item.prefix,
                              memberId: item.member_id,
                              singlesId: item.singles_id
                            })}${item.city ? ` | ${item.city}` : ''}`}
                          </MenuItem>
                        ))}
                      </TextField>
                      {recipientOptionsLoading ? (
                        <Typography sx={{ mt: 0.8, color: 'var(--theme-primary-color)' }}>Loading recipients...</Typography>
                      ) : null}
                      {recipientOptionsError ? (
                        <Typography sx={{ mt: 0.8, color: 'var(--theme-error-color)' }}>{recipientOptionsError}</Typography>
                      ) : null}
                    </Box>
                  ) : null}
                  {selectedProduct ? (
                    <Box sx={{ border: 'none', borderRadius: 2, p: 1.2, boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                        {selectedProduct?.image_url ? (
                          <Box
                            component="img"
                            src={selectedProduct.image_url}
                            alt={selectedProduct.title || 'selected flower'}
                            sx={{
                              width: 120,
                              height: 90,
                              objectFit: 'contain',
                              borderRadius: 1,
                              backgroundColor: '#fff'
                            }}
                          />
                        ) : null}
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontWeight: 700, color: 'var(--theme-primary-color)' }}>
                            {selectedProduct.title || `Product ${selectedProduct.product_id}`}
                          </Typography>
                          <Typography sx={{ fontSize: '0.84rem', color: '#555' }}>
                            {selectedProduct.amount != null
                              ? `$${Number(selectedProduct.amount).toFixed(2)}`
                              : 'Price available at checkout'}
                          </Typography>
                        </Box>
                        <Button
                          variant="contained"
                          onClick={onSelectAgain}
                          sx={{
                            textTransform: 'none',
                            minWidth: 130,
                            minHeight: { xs: 38, sm: 36 },
                            fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() },
                            bgcolor: 'var(--theme-primary-color)',
                            color: 'var(--theme-secondary-color)',
                            border: '1px solid var(--theme-secondary-color)',
                            '&:hover': {
                              bgcolor: 'var(--theme-primary-color)',
                              color: 'var(--theme-secondary-color)',
                              filter: 'brightness(0.92)'
                            }
                          }}
                        >
                          Select Again
                        </Button>
                      </Stack>
                    </Box>
                  ) : null}
                  <TextField
                    label="Delivery Date"
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                    sx={themedFieldSx}
                  />
                  <TextField
                    label="Card Message"
                    value={cardMessage}
                    onChange={(e) => setCardMessage(e.target.value)}
                    multiline
                    minRows={3}
                    fullWidth
                    sx={themedFieldSx}
                  />
                  <Typography sx={{ color: pageTextColor, fontWeight: 600 }}>Payment card (Authorize.Net secure token)</Typography>
                  <TextField
                    label="Card Number"
                    value={cardForm.cardNumber}
                    onChange={(e) => setCardForm((prev) => ({ ...prev, cardNumber: String(e.target.value || '').replace(/[^\d ]/g, '') }))}
                    placeholder="4111 1111 1111 1111"
                    fullWidth
                    sx={themedFieldSx}
                  />
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <TextField
                      label="Exp Month (MM)"
                      value={cardForm.expMonth}
                      onChange={(e) =>
                        setCardForm((prev) => ({
                          ...prev,
                          expMonth: String(e.target.value || '')
                            .replace(/\D/g, '')
                            .slice(0, 2)
                        }))
                      }
                      fullWidth
                      sx={themedFieldSx}
                    />
                    <TextField
                      label="Exp Year (YYYY)"
                      value={cardForm.expYear}
                      onChange={(e) =>
                        setCardForm((prev) => ({
                          ...prev,
                          expYear: String(e.target.value || '')
                            .replace(/\D/g, '')
                            .slice(0, 4)
                        }))
                      }
                      fullWidth
                      sx={themedFieldSx}
                    />
                    <TextField
                      label="CVV"
                      value={cardForm.cardCode}
                      onChange={(e) =>
                        setCardForm((prev) => ({
                          ...prev,
                          cardCode: String(e.target.value || '')
                            .replace(/\D/g, '')
                            .slice(0, 4)
                        }))
                      }
                      fullWidth
                      sx={themedFieldSx}
                    />
                    <TextField
                      label="Billing Zip"
                      value={cardForm.zip}
                      onChange={(e) =>
                        setCardForm((prev) => ({
                          ...prev,
                          zip: String(e.target.value || '')
                            .replace(/[^\w\- ]/g, '')
                            .slice(0, 10)
                        }))
                      }
                      fullWidth
                      sx={themedFieldSx}
                    />
                  </Stack>
                  {authNetLoading ? <Typography sx={{ color: pageTextColor }}>Loading Authorize.Net key...</Typography> : null}
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 1 }}>
                    <Button
                      variant="outlined"
                      onClick={() => navigate('/vettedFriends')}
                      fullWidth
                      sx={{
                        fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() },
                        textTransform: 'none',
                        minHeight: { xs: 38, sm: 36 },
                        bgcolor: 'var(--theme-daylight-color)',
                        color: 'var(--theme-primary-color)',
                        borderColor: 'var(--theme-primary-color)',
                        '&:hover': {
                          bgcolor: 'var(--theme-daylight-color)',
                          color: 'var(--theme-primary-color)',
                          borderColor: 'var(--theme-primary-color)',
                          filter: 'brightness(0.96)'
                        },
                        '&.Mui-disabled': {
                          bgcolor: 'var(--theme-daylight-color)',
                          color: 'var(--theme-primary-color)',
                          borderColor: 'var(--theme-primary-color)',
                          opacity: 0.6
                        }
                      }}
                    >
                      Cancel/Close
                    </Button>
                    <Button
                      variant="contained"
                      onClick={onPlaceOrder}
                      disabled={
                        placingOrder ||
                        !productId ||
                        !acceptScriptReady ||
                        authNetLoading ||
                        !Number.isFinite(targetSinglesId) ||
                        targetSinglesId < 1
                      }
                      fullWidth
                      sx={{
                        fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() },
                        textTransform: 'none',
                        minHeight: { xs: 38, sm: 36 },
                        bgcolor: 'var(--theme-primary-color)',
                        color: 'var(--theme-secondary-color)',
                        border: '1px solid var(--theme-secondary-color)',
                        '&:hover': {
                          bgcolor: 'var(--theme-primary-color)',
                          color: 'var(--theme-secondary-color)',
                          filter: 'brightness(0.92)'
                        },
                        '&.Mui-disabled': {
                          bgcolor: 'var(--theme-primary-color)',
                          color: 'var(--theme-secondary-color)',
                          borderColor: 'var(--theme-secondary-color)',
                          opacity: 0.6
                        }
                      }}
                    >
                      {placingOrder ? 'Sending...' : 'Send Flower Gift'}
                    </Button>
                  </Stack>
                </Stack>
              )}
            </Stack>
          ) : null}
        </Stack>
      </Box>
    </MainCard>
  );
}
