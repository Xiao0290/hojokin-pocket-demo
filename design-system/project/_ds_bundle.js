/* @ds-bundle: {"format":3,"namespace":"DesignSystem_a96fc8","components":[{"name":"AnimatedNumber","sourcePath":"components/data/AnimatedNumber.jsx"},{"name":"Badge","sourcePath":"components/display/Badge.jsx"},{"name":"Card","sourcePath":"components/display/Card.jsx"},{"name":"StatCard","sourcePath":"components/display/StatCard.jsx"},{"name":"EmptyState","sourcePath":"components/feedback/EmptyState.jsx"},{"name":"ProgressBar","sourcePath":"components/feedback/ProgressBar.jsx"},{"name":"Spinner","sourcePath":"components/feedback/Spinner.jsx"},{"name":"Button","sourcePath":"components/forms/Button.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"NavBar","sourcePath":"components/navigation/NavBar.jsx"},{"name":"PhoneFrame","sourcePath":"components/navigation/PhoneFrame.jsx"},{"name":"TabBar","sourcePath":"components/navigation/TabBar.jsx"},{"name":"ChatBubble","sourcePath":"components/patterns/ChatBubble.jsx"},{"name":"SubsidyRow","sourcePath":"components/patterns/SubsidyRow.jsx"},{"name":"Timeline","sourcePath":"components/patterns/Timeline.jsx"}],"sourceHashes":{"components/data/AnimatedNumber.jsx":"cc27af0bac9d","components/display/Badge.jsx":"2e39834f63de","components/display/Card.jsx":"032b0c9e053a","components/display/StatCard.jsx":"1144926a7f00","components/feedback/EmptyState.jsx":"8c827657e888","components/feedback/ProgressBar.jsx":"72fd6cfb5120","components/feedback/Spinner.jsx":"59ca57166868","components/forms/Button.jsx":"8885dc1432a0","components/forms/Checkbox.jsx":"78c82f03df74","components/forms/Input.jsx":"6f88d45f762f","components/navigation/NavBar.jsx":"de3e3c128fe1","components/navigation/PhoneFrame.jsx":"1cbbc281ae0f","components/navigation/TabBar.jsx":"782244f9233d","components/patterns/ChatBubble.jsx":"3f120cbac32f","components/patterns/SubsidyRow.jsx":"1f13078b601b","components/patterns/Timeline.jsx":"0b4ac44c733b","ui_kits/hojokin-pocket/data.js":"f573f36532b7","ui_kits/hojokin-pocket/screens-apply.jsx":"2db92daa197a","ui_kits/hojokin-pocket/screens-diagnose.jsx":"494f0f634919","ui_kits/hojokin-pocket/screens-expert.jsx":"b037cd82b180","ui_kits/hojokin-pocket/screens-submit.jsx":"1a9b57f43393"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.DesignSystem_a96fc8 = window.DesignSystem_a96fc8 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/data/AnimatedNumber.jsx
try { (() => {
const prefersReduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ===== slot-machine digit reel: rolls 0-9 and lands on `digit` ===== */
function SlotDigit({
  digit,
  duration,
  delay,
  cycles
}) {
  const finalIndex = cycles * 10 + digit;
  const [y, setY] = React.useState(0);
  React.useEffect(() => {
    if (prefersReduced()) {
      setY(finalIndex);
      return;
    }
    let r2;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setY(finalIndex));
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digit]);
  const cells = [];
  for (let c = 0; c < cycles; c++) for (let n = 0; n < 10; n++) cells.push(n);
  for (let n = 0; n <= digit; n++) cells.push(n);
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-block',
      height: '1em',
      lineHeight: '1em',
      overflow: 'hidden',
      verticalAlign: 'baseline',
      fontVariantNumeric: 'tabular-nums'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      transform: `translateY(-${y}em)`,
      transition: `transform ${duration}ms cubic-bezier(.16,.84,.30,1) ${delay}ms`
    }
  }, cells.map((n, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      display: 'block',
      height: '1em',
      lineHeight: '1em'
    }
  }, n))));
}
function format(value, fmt, decimals) {
  if (fmt === 'yen') return '¥' + Math.round(value).toLocaleString('en-US');
  if (fmt === 'percent') return (decimals > 0 ? value.toFixed(decimals) : String(Math.round(value))) + '%';
  if (fmt === 'comma') return decimals > 0 ? Number(value.toFixed(decimals)).toLocaleString('en-US') : Math.round(value).toLocaleString('en-US');
  return decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
}

/**
 * AnimatedNumber — figures that move into place.
 * variant="count" (default): smooth count-up from `from` to `value`.
 * variant="slot": slot-machine digit reels roll and settle left→right.
 */
function AnimatedNumber({
  value,
  format: fmt = 'plain',
  decimals = 0,
  duration = 1000,
  from = 0,
  prefix = '',
  suffix = '',
  variant = 'count',
  cycles = 2,
  style
}) {
  // ----- slot-machine variant -----
  if (variant === 'slot') {
    const text = format(value, fmt, decimals);
    let digitOrder = 0;
    const total = (text.match(/\d/g) || []).length;
    return /*#__PURE__*/React.createElement("span", {
      style: {
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        ...style
      }
    }, prefix, text.split('').map((ch, i) => {
      if (ch >= '0' && ch <= '9') {
        const order = digitOrder++;
        // rightmost reels spin a touch longer for an odometer feel
        const delay = order * 70;
        const dur = duration + (total - 1 - order) * 60;
        return /*#__PURE__*/React.createElement(SlotDigit, {
          key: i,
          digit: Number(ch),
          duration: dur,
          delay: delay,
          cycles: cycles
        });
      }
      return /*#__PURE__*/React.createElement("span", {
        key: i
      }, ch);
    }), suffix);
  }

  // ----- count-up variant -----
  const reduce = prefersReduced();
  const [display, setDisplay] = React.useState(reduce ? value : from);
  const raf = React.useRef(0);
  const fromRef = React.useRef(from);
  React.useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    const startVal = fromRef.current;
    const target = value;
    const startTime = performance.now();
    cancelAnimationFrame(raf.current);
    const tick = now => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(startVal + (target - startVal) * eased);
      if (t < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        setDisplay(target);
        fromRef.current = target;
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontVariantNumeric: 'tabular-nums',
      ...style
    }
  }, prefix, format(display, fmt, decimals), suffix);
}
Object.assign(__ds_scope, { AnimatedNumber });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/AnimatedNumber.jsx", error: String((e && e.message) || e) }); }

// components/display/Badge.jsx
try { (() => {
/**
 * Badge — small status / category pill.
 * Tones: solid, outline, success, warning, danger, neutral, brand-tint.
 */
function Badge({
  children,
  tone = 'neutral',
  style
}) {
  const tones = {
    solid: {
      background: 'var(--blue-500)',
      color: '#fff',
      border: 'none'
    },
    outline: {
      background: 'transparent',
      color: 'var(--blue-600)',
      border: '1px solid var(--blue-500)'
    },
    'brand-tint': {
      background: 'var(--surface-highlight)',
      color: 'var(--blue-600)',
      border: 'none'
    },
    success: {
      background: 'var(--success-bg)',
      color: 'var(--success)',
      border: 'none'
    },
    warning: {
      background: 'var(--warning-bg)',
      color: 'var(--warning)',
      border: 'none'
    },
    danger: {
      background: 'var(--danger-bg)',
      color: 'var(--danger)',
      border: 'none'
    },
    neutral: {
      background: 'var(--surface-subtle)',
      color: 'var(--gray-700)',
      border: 'none'
    }
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      whiteSpace: 'nowrap',
      fontFamily: 'var(--font)',
      fontSize: 'var(--fs-caption)',
      fontWeight: 'var(--fw-bold)',
      lineHeight: 1.4,
      padding: '3px 9px',
      borderRadius: 'var(--r-sm)',
      ...(tones[tone] || tones.neutral),
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Badge.jsx", error: String((e && e.message) || e) }); }

// components/display/Card.jsx
try { (() => {
/**
 * Card — base white surface with hairline border.
 * variant: default | highlight (brand tint + blue border).
 * tappable adds press feedback. Optional title/subtitle header.
 */
function Card({
  children,
  title,
  subtitle,
  variant = 'default',
  tappable = false,
  onClick,
  style
}) {
  const [pressed, setPressed] = React.useState(false);
  const isHl = variant === 'highlight';
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseDown: () => tappable && setPressed(true),
    onMouseUp: () => setPressed(false),
    onMouseLeave: () => setPressed(false),
    style: {
      background: isHl ? 'var(--surface-highlight)' : '#fff',
      border: isHl ? '1.5px solid var(--blue-500)' : '1px solid var(--line)',
      borderRadius: 'var(--r-lg)',
      padding: 'var(--sp-4)',
      cursor: tappable ? 'pointer' : 'default',
      transition: 'background var(--dur-fast) var(--ease)',
      ...(pressed ? {
        background: isHl ? '#e7eefe' : 'var(--surface-subtle)'
      } : null),
      ...style
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-title)',
      fontWeight: 'var(--fw-bold)',
      color: 'var(--ink)',
      marginBottom: subtitle ? 4 : 0
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-label)',
      color: isHl ? 'var(--blue-600)' : 'var(--gray-500)',
      fontWeight: isHl ? 'var(--fw-medium)' : 'var(--fw-regular)'
    }
  }, subtitle), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Card.jsx", error: String((e && e.message) || e) }); }

// components/display/StatCard.jsx
try { (() => {
/**
 * StatCard — horizontal row of labelled stats divided by hairlines.
 * Used for 補助上限 / 補助率 / 締切 on the subsidy detail screen.
 * Pass items as [{ k: label, v: value }].
 */
function StatCard({
  items = [],
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-lg)',
      overflow: 'hidden',
      ...style
    }
  }, items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      padding: 'var(--sp-3) var(--sp-4)',
      borderRight: i < items.length - 1 ? '1px solid var(--line-soft)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-caption)',
      color: 'var(--gray-500)',
      marginBottom: 6
    }
  }, it.k), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 'var(--fw-heavy)',
      color: 'var(--ink)'
    }
  }, it.v))));
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/feedback/EmptyState.jsx
try { (() => {
/**
 * EmptyState — centered placeholder for empty tabs/lists.
 * Primary line + optional muted hint.
 */
function EmptyState({
  title,
  hint,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'var(--sp-2)',
      color: 'var(--gray-400)',
      fontSize: 'var(--fs-body)',
      textAlign: 'center',
      padding: 'var(--sp-10)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", null, title), hint && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-label)'
    }
  }, hint));
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/feedback/ProgressBar.jsx
try { (() => {
/**
 * ProgressBar — thin determinate track, brand-blue fill.
 * value is 0–100.
 */
function ProgressBar({
  value = 0,
  style
}) {
  const pct = Math.max(0, Math.min(100, value));
  return /*#__PURE__*/React.createElement("div", {
    role: "progressbar",
    "aria-valuenow": pct,
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    style: {
      height: 5,
      background: 'var(--line)',
      borderRadius: 4,
      overflow: 'hidden',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      height: '100%',
      width: `${pct}%`,
      background: 'var(--blue-500)',
      borderRadius: 4,
      transition: 'width var(--dur) var(--ease)'
    }
  }));
}
Object.assign(__ds_scope, { ProgressBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/ProgressBar.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Spinner.jsx
try { (() => {
/**
 * Spinner — brand-blue ring loading indicator.
 * Used on the diagnose screen and inside loading buttons.
 */
function Spinner({
  size = 56,
  stroke = 5,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    role: "status",
    "aria-label": "\u8AAD\u307F\u8FBC\u307F\u4E2D",
    style: {
      display: 'inline-block',
      width: size,
      height: size,
      border: `${stroke}px solid var(--line)`,
      borderTopColor: 'var(--blue-500)',
      borderRadius: '50%',
      animation: 'hp-spinner .85s linear infinite',
      ...style
    }
  }, /*#__PURE__*/React.createElement("style", null, '@keyframes hp-spinner{to{transform:rotate(360deg)}}'));
}
Object.assign(__ds_scope, { Spinner });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Spinner.jsx", error: String((e && e.message) || e) }); }

// components/forms/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Button — 補助金ポケット primary action control.
 * Variants: primary (filled blue), secondary (tinted), ghost (outline).
 * Sizes: sm (40), md (52), lg (56). Full-width by default.
 */
function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = true,
  loading = false,
  disabled = false,
  onClick,
  style,
  ...rest
}) {
  const heights = {
    sm: 40,
    md: 52,
    lg: 56
  };
  const fontSizes = {
    sm: 'var(--fs-body)',
    md: 'var(--fs-body-lg)',
    lg: 'var(--fs-body-lg)'
  };
  const palettes = {
    primary: {
      background: 'var(--blue-500)',
      color: '#fff',
      border: 'none'
    },
    secondary: {
      background: 'var(--surface-highlight)',
      color: 'var(--blue-600)',
      border: 'none'
    },
    ghost: {
      background: '#fff',
      color: 'var(--ink)',
      border: '1px solid var(--line)'
    }
  };
  const isDisabled = disabled || loading;
  const pal = palettes[variant] || palettes.primary;
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--sp-2)',
    width: fullWidth ? '100%' : 'auto',
    minHeight: 'var(--touch-min)',
    height: heights[size],
    padding: '0 var(--sp-5)',
    borderRadius: 'var(--r-md)',
    fontFamily: 'var(--font)',
    fontSize: fontSizes[size],
    fontWeight: variant === 'ghost' ? 'var(--fw-medium)' : 'var(--fw-bold)',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    transition: 'transform var(--dur-fast) var(--ease), background var(--dur) var(--ease)',
    position: 'relative',
    ...pal,
    ...(isDisabled ? variant === 'ghost' ? {
      background: '#fff',
      color: 'var(--gray-400)',
      borderColor: 'var(--line-soft)'
    } : {
      background: 'var(--gray-300)',
      color: '#fff',
      border: 'none'
    } : null),
    ...style
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    style: base,
    disabled: isDisabled,
    "aria-busy": loading || undefined,
    onClick: isDisabled ? undefined : onClick,
    onMouseDown: e => !isDisabled && (e.currentTarget.style.transform = 'scale(0.985)'),
    onMouseUp: e => e.currentTarget.style.transform = 'scale(1)',
    onMouseLeave: e => e.currentTarget.style.transform = 'scale(1)'
  }, rest), loading && /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      position: 'absolute',
      width: 18,
      height: 18,
      borderRadius: '50%',
      border: '2.5px solid rgba(255,255,255,.45)',
      borderTopColor: '#fff',
      animation: 'hp-spin .8s linear infinite'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      visibility: loading ? 'hidden' : 'visible',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--sp-2)'
    }
  }, children), /*#__PURE__*/React.createElement("style", null, '@keyframes hp-spin{to{transform:rotate(360deg)}}'));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Button.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
/**
 * Checkbox — square brand-blue check used in application checklists.
 * Renders a 24px box; checked state fills blue with a white tick.
 */
function Checkbox({
  checked = false,
  onChange,
  label,
  aiTag,
  disabled = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "checkbox",
    "aria-checked": checked,
    onClick: disabled ? undefined : () => onChange && onChange(!checked),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--sp-3)',
      padding: 'var(--sp-4) 0',
      borderBottom: '1px solid var(--line-soft)',
      cursor: disabled ? 'default' : 'pointer',
      minHeight: 'var(--touch-min)',
      opacity: disabled ? 0.5 : 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 24,
      height: 24,
      flex: '0 0 24px',
      border: checked ? '2px solid var(--blue-500)' : '2px solid var(--gray-300)',
      background: checked ? 'var(--blue-500)' : 'transparent',
      borderRadius: 7,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all var(--dur-fast) var(--ease)'
    }
  }, checked && /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "14",
    height: "14",
    fill: "none",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M5 12.5l4.5 4.5L19 7",
    stroke: "#fff",
    strokeWidth: "2.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }))), label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-body-lg)',
      color: 'var(--ink)',
      fontWeight: 'var(--fw-medium)'
    }
  }, label), aiTag && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--blue-500)',
      border: '1px solid var(--blue-500)',
      borderRadius: 5,
      padding: '2px 6px',
      fontWeight: 'var(--fw-medium)',
      marginLeft: 'var(--sp-2)'
    }
  }, "AI\u4E0B\u66F8\u304D"));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Input — single-line text field with optional label.
 * Tall (58px) iOS-style field; focus moves border to brand blue.
 */
function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  error,
  disabled = false,
  style,
  ...rest
}) {
  const [focused, setFocused] = React.useState(false);
  const borderColor = error ? 'var(--danger)' : focused ? 'var(--blue-500)' : 'var(--line)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--sp-2)'
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-label)',
      color: 'var(--gray-500)',
      fontWeight: 'var(--fw-medium)'
    }
  }, label), /*#__PURE__*/React.createElement("input", _extends({
    type: type,
    value: value,
    placeholder: placeholder,
    disabled: disabled,
    onChange: onChange,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: {
      width: '100%',
      minHeight: 'var(--touch-min)',
      height: 58,
      padding: '0 var(--sp-5)',
      border: `1.5px solid ${borderColor}`,
      borderRadius: 'var(--r-md)',
      fontFamily: 'var(--font)',
      fontSize: 'var(--fs-title)',
      color: disabled ? 'var(--gray-400)' : 'var(--ink)',
      background: disabled ? 'var(--surface-subtle)' : '#fff',
      outline: 'none',
      transition: 'border-color var(--dur) var(--ease)',
      ...style
    }
  }, rest)), error && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-caption)',
      color: 'var(--danger)'
    }
  }, error));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/navigation/NavBar.jsx
try { (() => {
/**
 * NavBar — iOS-style centered title bar with optional back/left and
 * right actions. brand=true shows the 補助金ポケット wordmark with a
 * blue accent on the final character.
 */
function NavBar({
  title,
  left,
  right,
  onLeft,
  onRight,
  brand = false,
  noBorder = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 44,
      flex: '0 0 auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      borderBottom: noBorder ? 'none' : '1px solid var(--line-soft)',
      padding: '0 var(--sp-3)',
      background: '#fff'
    }
  }, left && /*#__PURE__*/React.createElement("span", {
    onClick: onLeft,
    style: {
      position: 'absolute',
      left: 14,
      fontSize: 'var(--fs-body)',
      color: 'var(--blue-500)',
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
      userSelect: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 19,
      marginRight: 1,
      lineHeight: 1
    }
  }, "\u2039"), left !== true && left), brand ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 'var(--fw-bold)',
      color: 'var(--ink)'
    }
  }, "\u88DC\u52A9\u91D1\u30DD\u30B1\u30C3", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--blue-500)'
    }
  }, "\u30C8")) : /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 'var(--fw-bold)',
      color: 'var(--ink)'
    }
  }, title), right && /*#__PURE__*/React.createElement("span", {
    onClick: onRight,
    style: {
      position: 'absolute',
      right: 16,
      fontSize: 'var(--fs-body)',
      color: 'var(--blue-500)',
      fontWeight: 'var(--fw-medium)',
      cursor: 'pointer',
      userSelect: 'none'
    }
  }, right));
}
Object.assign(__ds_scope, { NavBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/NavBar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/PhoneFrame.jsx
try { (() => {
function StatusBar() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 30,
      flex: '0 0 30px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 22px',
      fontSize: 13,
      fontWeight: 600,
      color: '#000',
      letterSpacing: '.2px'
    }
  }, /*#__PURE__*/React.createElement("span", null, "9:41"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 11,
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement("span", null, "5G"), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 22,
      height: 11,
      border: '1px solid #000',
      borderRadius: 3,
      position: 'relative',
      padding: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      height: '100%',
      width: '80%',
      background: '#000',
      borderRadius: 1
    }
  }))));
}

/**
 * PhoneFrame — rounded device shell that wraps a screen. Includes the
 * status bar. Children are the screen content (NavBar, scroll area, TabBar).
 */
function PhoneFrame({
  children,
  statusBar = true,
  width = 390,
  height = 844,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width,
      height,
      background: '#fff',
      borderRadius: 30,
      boxShadow: '0 24px 60px rgba(20,30,60,.28), 0 2px 0 rgba(255,255,255,.4) inset',
      overflow: 'hidden',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid rgba(0,0,0,.06)',
      ...style
    }
  }, statusBar && /*#__PURE__*/React.createElement(StatusBar, null), children);
}
Object.assign(__ds_scope, { PhoneFrame });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/PhoneFrame.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TabBar.jsx
try { (() => {
const ICONS = {
  diag: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    width: "20",
    height: "20"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "7",
    stroke: "currentColor",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16 16l4 4",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  })),
  apply: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    width: "20",
    height: "20"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "5",
    y: "3",
    width: "14",
    height: "18",
    rx: "2",
    stroke: "currentColor",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 8h6M9 12h6M9 16h4",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  })),
  msg: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    width: "20",
    height: "20"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 5h16v11H9l-4 4V5z",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinejoin: "round"
  })),
  mypage: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    width: "20",
    height: "20"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "8",
    r: "3.5",
    stroke: "currentColor",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 20c0-3.5 3-6 7-6s7 2.5 7 6",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }))
};
const DEFAULT_TABS = [{
  id: 'diag',
  label: '診断'
}, {
  id: 'apply',
  label: '申請'
}, {
  id: 'msg',
  label: 'メッセージ'
}, {
  id: 'mypage',
  label: 'マイページ'
}];

/**
 * TabBar — bottom navigation with the four app sections.
 * Active tab turns brand blue. Built-in line icons (diag/apply/msg/mypage).
 */
function TabBar({
  active = 'diag',
  onChange,
  tabs = DEFAULT_TABS
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 52,
      flex: '0 0 auto',
      display: 'flex',
      borderTop: '1px solid var(--line-soft)',
      background: '#fff'
    }
  }, tabs.map(t => {
    const isActive = active === t.id;
    return /*#__PURE__*/React.createElement("div", {
      key: t.id,
      onClick: () => onChange && onChange(t.id),
      style: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        fontSize: 'var(--fs-caption)',
        color: isActive ? 'var(--blue-500)' : 'var(--gray-500)',
        fontWeight: isActive ? 'var(--fw-medium)' : 'var(--fw-regular)',
        cursor: 'pointer',
        userSelect: 'none'
      }
    }, ICONS[t.id], /*#__PURE__*/React.createElement("span", null, t.label));
  }));
}
Object.assign(__ds_scope, { TabBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TabBar.jsx", error: String((e && e.message) || e) }); }

// components/patterns/ChatBubble.jsx
try { (() => {
/**
 * ChatBubble — a single message bubble. from='me' (brand blue, right)
 * or 'them' (grey, left). Use a centered system note via variant='system'.
 */
function ChatBubble({
  children,
  from = 'them',
  variant
}) {
  if (variant === 'system') {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: 'center',
        fontSize: 'var(--fs-label)',
        color: 'var(--gray-500)',
        margin: '0 0 14px'
      }
    }, children);
  }
  const isMe = from === 'me';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: '78%',
      padding: '13px 16px',
      borderRadius: 18,
      fontSize: 'var(--fs-body)',
      lineHeight: 'var(--lh-snug)',
      marginLeft: isMe ? 'auto' : 0,
      background: isMe ? 'var(--blue-500)' : 'var(--surface-subtle)',
      color: isMe ? '#fff' : 'var(--ink)',
      borderBottomRightRadius: isMe ? 5 : 18,
      borderBottomLeftRadius: isMe ? 18 : 5
    }
  }, children));
}
Object.assign(__ds_scope, { ChatBubble });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/patterns/ChatBubble.jsx", error: String((e && e.message) || e) }); }

// components/patterns/SubsidyRow.jsx
try { (() => {
/**
 * SubsidyRow — a tappable list row for a subsidy result. Name + frame
 * label + a meta line of stats, with a trailing chevron and hairline.
 * Pass meta as [{ label, value }]; value renders bold.
 */
function SubsidyRow({
  name,
  frame,
  meta = [],
  onClick
}) {
  const [pressed, setPressed] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseDown: () => setPressed(true),
    onMouseUp: () => setPressed(false),
    onMouseLeave: () => setPressed(false),
    style: {
      position: 'relative',
      padding: 'var(--sp-5) 0',
      borderBottom: '1px solid var(--line-soft)',
      cursor: 'pointer',
      opacity: pressed ? 0.6 : 1,
      transition: 'opacity var(--dur-fast) var(--ease)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-title)',
      fontWeight: 'var(--fw-bold)',
      color: 'var(--ink)',
      marginBottom: 4,
      paddingRight: 22
    }
  }, name), frame && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-label)',
      color: 'var(--gray-500)',
      marginBottom: 'var(--sp-2)'
    }
  }, frame), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--sp-4)',
      fontSize: 13.5,
      color: 'var(--gray-700)'
    }
  }, meta.map((m, i) => /*#__PURE__*/React.createElement("span", {
    key: i
  }, m.label, " ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)',
      fontWeight: 'var(--fw-bold)'
    }
  }, m.value)))), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      right: 0,
      top: 'var(--sp-5)',
      color: 'var(--gray-300)',
      fontSize: 20
    }
  }, "\u203A"));
}
Object.assign(__ds_scope, { SubsidyRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/patterns/SubsidyRow.jsx", error: String((e && e.message) || e) }); }

// components/patterns/Timeline.jsx
try { (() => {
/**
 * Timeline — vertical application-status timeline. Pass items as
 * [{ title, sub, state }] where state is 'done' | 'active' | 'todo'.
 */
function Timeline({
  items = []
}) {
  return /*#__PURE__*/React.createElement("div", null, items.map((item, i) => {
    const last = i === items.length - 1;
    const lineDone = item.state === 'done';
    const dotStyle = item.state === 'done' ? {
      background: 'var(--blue-500)'
    } : item.state === 'active' ? {
      background: '#fff',
      border: '3px solid var(--blue-500)'
    } : {
      background: '#fff',
      border: '2px solid var(--gray-300)'
    };
    const titleColor = item.state === 'active' ? 'var(--blue-500)' : item.state === 'todo' ? 'var(--gray-400)' : 'var(--ink)';
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: 'flex',
        gap: 'var(--sp-4)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flex: '0 0 24px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 22,
        height: 22,
        flex: '0 0 22px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...dotStyle
      }
    }, item.state === 'done' && /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 24 24",
      width: "12",
      height: "12",
      fill: "none",
      "aria-hidden": "true"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M5 12.5l4.5 4.5L19 7",
      stroke: "#fff",
      strokeWidth: "2.6",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }))), !last && /*#__PURE__*/React.createElement("span", {
      style: {
        width: 2,
        flex: 1,
        minHeight: 18,
        background: lineDone ? 'var(--blue-500)' : 'var(--line)'
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        paddingBottom: 'var(--sp-5)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 'var(--fs-body-lg)',
        fontWeight: 'var(--fw-bold)',
        color: titleColor,
        lineHeight: 'var(--lh-tight)'
      }
    }, item.title), item.sub && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 'var(--fs-label)',
        color: 'var(--gray-500)',
        marginTop: 3
      }
    }, item.sub)));
  }));
}
Object.assign(__ds_scope, { Timeline });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/patterns/Timeline.jsx", error: String((e && e.message) || e) }); }

// ui_kits/hojokin-pocket/data.js
try { (() => {
// 補助金ポケット — demo data (window globals for the UI kit)
window.KIT = window.KIT || {};
window.KIT.yen = n => '¥' + n.toLocaleString('en-US');
window.KIT.SUBSIDIES = [{
  id: 'saikochiku',
  name: '事業再構築補助金',
  frame: '成長枠',
  limit: 30000000,
  rate: '1/2',
  deadline: '8/29',
  adoptionRate: 68,
  daysLeft: 62,
  round: '成長枠・第13回公募'
}, {
  id: 'monozukuri',
  name: 'ものづくり補助金',
  frame: '製品・サービス高付加価値化枠',
  limit: 10000000,
  rate: '1/2',
  deadline: '9/12',
  adoptionRate: 72,
  daysLeft: 48,
  round: '製品・サービス高付加価値化枠'
}, {
  id: 'it',
  name: 'IT導入補助金',
  frame: '通常枠',
  limit: 4500000,
  rate: '1/2',
  deadline: '8/22',
  adoptionRate: 81,
  daysLeft: 30,
  round: '通常枠'
}, {
  id: 'shoryokuka',
  name: '中小企業省力化投資補助金',
  frame: '一般型',
  limit: 10000000,
  rate: '1/2',
  deadline: '10/3',
  adoptionRate: 65,
  daysLeft: 74,
  round: '一般型'
}, {
  id: 'jizokuka',
  name: '小規模事業者持続化補助金',
  frame: '通常枠',
  limit: 2000000,
  rate: '2/3',
  deadline: '8/12',
  adoptionRate: 79,
  daysLeft: 21,
  round: '通常枠'
}, {
  id: 'shoene',
  name: '省エネ補助金',
  frame: '設備更新枠',
  limit: 15000000,
  rate: '1/3',
  deadline: '9/30',
  adoptionRate: 70,
  daysLeft: 70,
  round: '設備更新枠'
}, {
  id: 'jigyoshokei',
  name: '事業承継・引継ぎ補助金',
  frame: '専門家活用枠',
  limit: 6000000,
  rate: '2/3',
  deadline: '9/5',
  adoptionRate: 74,
  daysLeft: 41,
  round: '専門家活用枠'
}, {
  id: 'career',
  name: 'キャリアアップ助成金',
  frame: '正社員化コース',
  limit: 800000,
  rate: '—',
  deadline: '随時',
  adoptionRate: 88,
  daysLeft: 90,
  round: '正社員化コース'
}];
window.KIT.RESULT_SUMMARY = {
  count: 8,
  totalLimit: 48300000
};
window.KIT.APPLY_STEPS = [{
  id: 'plan',
  label: '事業計画書を作成する',
  aiDraft: true
}, {
  id: 'kessan',
  label: '決算書を準備する（直近2期）',
  aiDraft: false
}, {
  id: 'mitsumori',
  label: '設備の見積書を取得する',
  aiDraft: false
}, {
  id: 'gbiz',
  label: 'gBizIDプライムを取得する',
  aiDraft: false
}, {
  id: 'chinage',
  label: '賃上げ要件を確認する',
  aiDraft: true
}];
window.KIT.BUSINESS_PLAN = {
  maxChars: 4200,
  sections: [{
    heading: '1. 事業の概要',
    body: '当社は、組込みソフトウェアおよびIoTデバイスの受託開発を主力事業とする企業である。創業以来培ってきた制御技術を強みに、製造業の生産設備向けソリューションを提供してきた。本事業では、これまでの受託開発で蓄積した知見を活かし、自社プロダクトとしてのクラウド型設備監視サービスを新たに立ち上げ、収益構造の多角化と事業の再構築を図る。'
  }, {
    heading: '2. 事業再構築の必要性',
    body: '近年、受託開発市場は価格競争が激化し、案件単価の下落が続いている。一方で、製造現場ではDX需要が急速に高まっており、設備の稼働データを活用した予知保全・遠隔監視へのニーズが顕在化している。当社が下請構造から脱却し、継続的な収益を生むストック型ビジネスへ転換することは、持続的な成長のために不可欠である。'
  }, {
    heading: '3. 市場の動向と優位性',
    body: '国内の設備保全市場は年率8%で拡大しており、特に中小製造業向けの安価で導入しやすい監視サービスは供給が不足している。当社は現場で実証済みの制御技術と既存顧客基盤を有しており、競合に対して導入実績と信頼性の面で明確な優位性を持つ。'
  }, {
    heading: '4. 投資計画と資金使途',
    body: '本補助事業では、クラウド基盤の構築費、エッジ端末の開発費、および販売体制強化のための人材投資を行う。総事業費6,000万円のうち、補助対象経費に対して1/2の補助を受けることで、初期投資の回収期間を大幅に短縮し、早期の黒字化を実現する。'
  }, {
    heading: '5. 収益計画と将来展望',
    body: 'サービス開始3年目で導入企業120社、月額課金による経常収益2億円を見込む。5年後には海外展開も視野に入れ、当社の事業ポートフォリオにおける自社プロダクト比率を50%まで引き上げることを目標とする。'
  }]
};
window.KIT.APPLY_METHOD = {
  self: 68,
  expert: 89,
  gain: 21
};
window.KIT.EXPERTS = [{
  id: 'sagami',
  name: 'あおい行政書士事務所',
  area: '神奈川県',
  tags: '事業再構築 / ものづくり',
  adoptions: 124,
  rating: 4.9,
  upfront: '着手金0円',
  success: 20,
  recommended: true
}, {
  id: 'shonan',
  name: 'みどり経営サポート',
  area: '神奈川県',
  tags: '創業 / 補助金全般',
  adoptions: 86,
  rating: 4.7,
  upfront: '着手金0円',
  success: 18,
  recommended: false
}, {
  id: 'yokohama',
  name: 'さくら士業オフィス',
  area: '神奈川県',
  tags: 'IT導入 / 省力化',
  adoptions: 152,
  rating: 4.8,
  upfront: '着手金3万円',
  success: 15,
  recommended: false
}];
window.KIT.STATUS_TIMELINE = [{
  id: 1,
  title: '補助金を診断',
  sub: '8件マッチ',
  state: 'done'
}, {
  id: 2,
  title: '申請書を作成',
  sub: 'AIが事業計画書を作成',
  state: 'done'
}, {
  id: 3,
  title: '専門家に依頼',
  sub: 'あおい行政書士事務所',
  state: 'done'
}, {
  id: 4,
  title: '専門家レビュー完了',
  sub: '加点提案を反映しました',
  state: 'done'
}, {
  id: 5,
  title: '申請を提出',
  sub: '提出の準備ができました',
  state: 'active'
}, {
  id: 6,
  title: '採択結果を待つ',
  sub: '',
  state: 'todo'
}];
window.KIT.SUBMIT_DOCS = [{
  id: 'plan',
  label: '事業計画書',
  note: '専門家確認済み'
}, {
  id: 'kessan',
  label: '決算書（直近2期）',
  note: ''
}, {
  id: 'mitsumori',
  label: '設備の見積書',
  note: ''
}, {
  id: 'gbiz',
  label: 'gBizIDプライム連携',
  note: ''
}];
window.KIT.DIAGNOSE_STEPS = [{
  label: 'サイトを読み込み'
}, {
  label: '事業内容を解析'
}, {
  count: 2847,
  after: '制度と照合'
}];
window.KIT.RECEIPT_NO = 'R7-13-04821';
window.KIT.COMPANY_NAME = '株式会社サンプル商会';
window.KIT.DEFAULT_URL = 'sample-corp.example';
window.KIT.INITIAL_RECENT = {
  name: '株式会社サンプル製作所',
  matches: 6,
  totalLimit: 21500000,
  when: '3日前'
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/hojokin-pocket/data.js", error: String((e && e.message) || e) }); }

// ui_kits/hojokin-pocket/screens-apply.jsx
try { (() => {
/* 補助金ポケット — apply (detail / business plan / method) screens */
;
(function () {
  const DS = window.DesignSystem_a96fc8;
  const K = window.KIT;
  const AN = DS.AnimatedNumber;
  const {
    useState,
    useEffect,
    useRef
  } = React;
  const S = window.KIT.Screens = window.KIT.Screens || {};

  // ===== Subsidy detail =====
  S.SubsidyDetail = function SubsidyDetail({
    nav,
    app
  }) {
    const s = app.selectedSubsidy;
    const [checked, setChecked] = useState({});
    const doneCount = Object.values(checked).filter(Boolean).length;
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(DS.NavBar, {
      title: s.name,
      left: "\u7D50\u679C",
      onLeft: () => nav.back()
    }), /*#__PURE__*/React.createElement("div", {
      className: "screen fade"
    }, /*#__PURE__*/React.createElement("div", {
      className: "pad"
    }, /*#__PURE__*/React.createElement(DS.StatCard, {
      items: [{
        k: '補助上限',
        v: /*#__PURE__*/React.createElement(AN, {
          value: s.limit,
          format: "yen"
        })
      }, {
        k: '補助率',
        v: s.rate
      }, {
        k: '締切',
        v: s.deadline
      }]
    }), /*#__PURE__*/React.createElement("div", {
      className: "steps-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "section-h"
    }, "\u7533\u8ACB\u306E\u9032\u3081\u65B9"), /*#__PURE__*/React.createElement("span", {
      className: "r"
    }, doneCount, " / ", K.APPLY_STEPS.length, " \u5B8C\u4E86")), K.APPLY_STEPS.map(st => /*#__PURE__*/React.createElement(DS.Checkbox, {
      key: st.id,
      label: st.label,
      aiTag: st.aiDraft,
      checked: !!checked[st.id],
      onChange: v => setChecked(c => ({
        ...c,
        [st.id]: v
      }))
    })))), /*#__PURE__*/React.createElement("div", {
      className: "footer"
    }, /*#__PURE__*/React.createElement(DS.Button, {
      variant: "primary",
      onClick: () => nav.go('plan')
    }, "\u7533\u8ACB\u66F8\u3092AI\u3067\u4F5C\u6210\u3059\u308B")));
  };

  // ===== Business plan (AI streaming) =====
  function buildBlocks() {
    const blocks = [];
    for (const sec of K.BUSINESS_PLAN.sections) {
      blocks.push({
        type: 'h',
        text: sec.heading
      });
      blocks.push({
        type: 'p',
        text: sec.body
      });
    }
    return blocks;
  }
  S.BusinessPlan = function BusinessPlan({
    nav
  }) {
    const blocks = useRef(buildBlocks()).current;
    const totalChars = useRef(blocks.reduce((a, b) => a + b.text.length, 0)).current;
    const [shown, setShown] = useState(0);
    const done = shown >= totalChars;
    useEffect(() => {
      if (done) return;
      const id = setInterval(() => setShown(s => Math.min(s + 7, totalChars)), 22);
      return () => clearInterval(id);
    }, [done, totalChars]);
    const displayCount = Math.round(shown / totalChars * K.BUSINESS_PLAN.maxChars);
    let consumed = 0;
    const rendered = blocks.map((b, i) => {
      const remaining = shown - consumed;
      const n = Math.max(0, Math.min(remaining, b.text.length));
      consumed += b.text.length;
      if (n <= 0) return null;
      const partial = n < b.text.length;
      const text = b.text.slice(0, n);
      return b.type === 'h' ? /*#__PURE__*/React.createElement("div", {
        className: "bp-h",
        key: i
      }, text, partial && /*#__PURE__*/React.createElement("span", {
        className: "caret"
      })) : /*#__PURE__*/React.createElement("div", {
        className: "bp-b",
        key: i
      }, text, partial && /*#__PURE__*/React.createElement("span", {
        className: "caret"
      }));
    });
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(DS.NavBar, {
      title: "\u4E8B\u696D\u8A08\u753B\u66F8",
      left: "\u623B\u308B",
      onLeft: () => nav.back(),
      right: done ? '保存' : undefined
    }), /*#__PURE__*/React.createElement("div", {
      className: "screen"
    }, /*#__PURE__*/React.createElement("div", {
      className: "pad"
    }, /*#__PURE__*/React.createElement("div", {
      className: "bp-status"
    }, /*#__PURE__*/React.createElement("span", {
      className: "l"
    }, /*#__PURE__*/React.createElement("span", {
      className: 'dot' + (done ? '' : ' live')
    }), done ? 'AIが作成しました' : 'AIが作成しています'), /*#__PURE__*/React.createElement("span", {
      className: "c"
    }, displayCount.toLocaleString(), " / ", K.BUSINESS_PLAN.maxChars.toLocaleString(), " \u5B57")), rendered)), done && /*#__PURE__*/React.createElement("div", {
      className: "footer fade"
    }, /*#__PURE__*/React.createElement(DS.Button, {
      variant: "primary",
      onClick: () => nav.go('method')
    }, "\u6B21\u3078")));
  };

  // ===== Apply method (68% vs 89%) =====
  S.ApplyMethod = function ApplyMethod({
    nav
  }) {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(DS.NavBar, {
      title: "\u7533\u8ACB\u65B9\u6CD5",
      left: "\u623B\u308B",
      onLeft: () => nav.back()
    }), /*#__PURE__*/React.createElement("div", {
      className: "screen fade"
    }, /*#__PURE__*/React.createElement("div", {
      className: "pad"
    }, /*#__PURE__*/React.createElement("div", {
      className: "method-h"
    }, "\u7533\u8ACB\u66F8\u304C\u3067\u304D\u307E\u3057\u305F\u3002", /*#__PURE__*/React.createElement("br", null), "\u3069\u3046\u9032\u3081\u307E\u3059\u304B\uFF1F"), /*#__PURE__*/React.createElement("p", {
      className: "lead"
    }, "\u5C02\u9580\u5BB6\u306E\u30C1\u30A7\u30C3\u30AF\u3092\u5165\u308C\u308B\u3068\u3001\u63A1\u629E\u7387\u304C\u4E0A\u304C\u308A\u307E\u3059\u3002"), /*#__PURE__*/React.createElement("div", {
      className: "method-cards"
    }, /*#__PURE__*/React.createElement("div", {
      className: "method-card"
    }, /*#__PURE__*/React.createElement("div", {
      className: "t"
    }, "\u81EA\u5206\u3067\u7533\u8ACB"), /*#__PURE__*/React.createElement("div", {
      className: "p"
    }, /*#__PURE__*/React.createElement(AN, {
      value: K.APPLY_METHOD.self,
      variant: "slot"
    }), /*#__PURE__*/React.createElement("small", null, "%")), /*#__PURE__*/React.createElement("div", {
      className: "n"
    }, "\u60F3\u5B9A\u63A1\u629E\u7387")), /*#__PURE__*/React.createElement("div", {
      className: "method-card hl"
    }, /*#__PURE__*/React.createElement("div", {
      className: "t"
    }, "\u5C02\u9580\u5BB6\u306B\u4F9D\u983C"), /*#__PURE__*/React.createElement("div", {
      className: "p"
    }, /*#__PURE__*/React.createElement(AN, {
      value: K.APPLY_METHOD.expert,
      variant: "slot"
    }), /*#__PURE__*/React.createElement("small", null, "%")), /*#__PURE__*/React.createElement("div", {
      className: "n"
    }, "+", /*#__PURE__*/React.createElement(AN, {
      value: K.APPLY_METHOD.gain
    }), "pt \u4E0A\u304C\u308B"))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement(DS.Button, {
      variant: "primary",
      onClick: () => nav.go('expert')
    }, "\u5C02\u9580\u5BB6\u306B\u4F9D\u983C\u3059\u308B")), /*#__PURE__*/React.createElement(DS.Button, {
      variant: "ghost",
      onClick: () => {
        nav.set({
          hasApplied: true
        });
        nav.go('status');
      }
    }, "\u81EA\u5206\u3067\u3053\u306E\u307E\u307E\u7533\u8ACB\u3059\u308B"))));
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/hojokin-pocket/screens-apply.jsx", error: String((e && e.message) || e) }); }

// ui_kits/hojokin-pocket/screens-diagnose.jsx
try { (() => {
/* 補助金ポケット — diagnose tab screens */
;
(function () {
  const DS = window.DesignSystem_a96fc8;
  const K = window.KIT;
  const AN = DS.AnimatedNumber;
  const {
    useState,
    useEffect
  } = React;
  const S = window.KIT.Screens = window.KIT.Screens || {};

  // ===== Home (診断) =====
  S.Home = function Home({
    nav,
    app
  }) {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(DS.NavBar, {
      brand: true
    }), /*#__PURE__*/React.createElement("div", {
      className: "screen fade"
    }, /*#__PURE__*/React.createElement("div", {
      className: "pad"
    }, /*#__PURE__*/React.createElement("p", {
      className: "lead",
      style: {
        marginTop: 4,
        marginBottom: 22
      }
    }, "\u4F1A\u793E\u306EURL\u3092\u5165\u529B\u3059\u308B\u3068\u3001\u7533\u8ACB\u3067\u304D\u308B\u88DC\u52A9\u91D1\u3092AI\u304C\u8A3A\u65AD\u3057\u307E\u3059\u3002"), /*#__PURE__*/React.createElement(DS.Input, {
      label: "\u4F1A\u793E\u306EURL",
      placeholder: "https://\u4F1A\u793E\u306EURL",
      value: app.url,
      onChange: e => nav.set({
        url: e.target.value
      })
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 16
      }
    }, /*#__PURE__*/React.createElement(DS.Button, {
      variant: "primary",
      onClick: () => nav.go('diagnosing')
    }, "\u88DC\u52A9\u91D1\u3092\u8A3A\u65AD\u3059\u308B")), app.hasApplied && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "section-h",
      style: {
        margin: '26px 0 12px'
      }
    }, "\u7533\u8ACB\u4E2D"), /*#__PURE__*/React.createElement(DS.Card, {
      variant: "highlight",
      tappable: true,
      onClick: () => nav.go('status'),
      title: "\u4E8B\u696D\u518D\u69CB\u7BC9\u88DC\u52A9\u91D1",
      subtitle: `審査中 ・ 本日提出 ・ 受付番号 ${K.RECEIPT_NO}`
    })), /*#__PURE__*/React.createElement("div", {
      className: "section-h",
      style: {
        margin: '26px 0 12px'
      }
    }, "\u6700\u8FD1\u306E\u8A3A\u65AD"), app.hasApplied ? /*#__PURE__*/React.createElement(DS.Card, {
      tappable: true,
      onClick: () => nav.go('results'),
      title: K.COMPANY_NAME,
      subtitle: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(AN, {
        value: K.RESULT_SUMMARY.count,
        suffix: "\u4EF6\u30DE\u30C3\u30C1"
      }), " \u30FB \u4E0A\u9650\u5408\u8A08 ", /*#__PURE__*/React.createElement(AN, {
        value: K.RESULT_SUMMARY.totalLimit,
        format: "yen"
      }), " \u30FB \u305F\u3063\u305F\u4ECA")
    }) : /*#__PURE__*/React.createElement(DS.Card, {
      tappable: true,
      onClick: () => nav.go('results'),
      title: K.INITIAL_RECENT.name,
      subtitle: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(AN, {
        value: K.INITIAL_RECENT.matches,
        suffix: "\u4EF6\u30DE\u30C3\u30C1"
      }), " \u30FB \u4E0A\u9650\u5408\u8A08 ", /*#__PURE__*/React.createElement(AN, {
        value: K.INITIAL_RECENT.totalLimit,
        format: "yen"
      }), " \u30FB ", K.INITIAL_RECENT.when)
    }))));
  };

  // ===== Diagnosing =====
  S.Diagnosing = function Diagnosing({
    nav,
    app
  }) {
    const [pct, setPct] = useState(8);
    const [active, setActive] = useState(0);
    const url = app.url?.trim() ? app.url.replace(/^https?:\/\//, '').replace(/\/$/, '') : K.DEFAULT_URL;
    useEffect(() => {
      const t = [setTimeout(() => {
        setPct(45);
        setActive(1);
      }, 700), setTimeout(() => {
        setPct(80);
        setActive(2);
      }, 1500), setTimeout(() => setPct(100), 2200), setTimeout(() => {
        nav.replace('results');
      }, 2800)];
      return () => t.forEach(clearTimeout);
    }, []);
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(DS.NavBar, {
      title: "\u8A3A\u65AD\u4E2D"
    }), /*#__PURE__*/React.createElement("div", {
      className: "screen"
    }, /*#__PURE__*/React.createElement("div", {
      className: "diag-wrap"
    }, /*#__PURE__*/React.createElement(DS.Spinner, {
      style: {
        margin: '8px 0 22px'
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "diag-h"
    }, "\u4F1A\u793E\u60C5\u5831\u3092\u89E3\u6790\u3057\u3066\u3044\u307E\u3059"), /*#__PURE__*/React.createElement("div", {
      className: "diag-url"
    }, url), /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 26
      }
    }, /*#__PURE__*/React.createElement(DS.ProgressBar, {
      value: pct
    })), K.DIAGNOSE_STEPS.map((s, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      className: 'diag-step' + (i <= active ? ' on' : '')
    }, /*#__PURE__*/React.createElement("span", {
      className: "dot"
    }), /*#__PURE__*/React.createElement("span", null, s.count != null ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(AN, {
      value: s.count,
      format: "comma"
    }), s.after) : s.label))))));
  };

  // ===== Results =====
  S.Results = function Results({
    nav
  }) {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(DS.NavBar, {
      title: "\u8A3A\u65AD\u7D50\u679C",
      left: "\u8A3A\u65AD",
      onLeft: () => nav.home(),
      right: "\u4FDD\u5B58"
    }), /*#__PURE__*/React.createElement("div", {
      className: "screen fade"
    }, /*#__PURE__*/React.createElement("div", {
      className: "pad"
    }, /*#__PURE__*/React.createElement("div", {
      className: "section-h",
      style: {
        marginBottom: 10
      }
    }, "\u7533\u8ACB\u3067\u304D\u308B\u88DC\u52A9\u91D1"), /*#__PURE__*/React.createElement("div", {
      className: "result-count"
    }, /*#__PURE__*/React.createElement("span", {
      className: "big"
    }, /*#__PURE__*/React.createElement(AN, {
      value: K.RESULT_SUMMARY.count,
      suffix: "\u4EF6",
      variant: "slot"
    })), /*#__PURE__*/React.createElement("span", {
      className: "sum"
    }, "\u4E0A\u9650\u5408\u8A08 ", /*#__PURE__*/React.createElement(AN, {
      value: K.RESULT_SUMMARY.totalLimit,
      format: "yen",
      variant: "slot"
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 8
      }
    }, K.SUBSIDIES.map(s => /*#__PURE__*/React.createElement(DS.SubsidyRow, {
      key: s.id,
      name: s.name,
      frame: s.frame,
      meta: [{
        label: '上限',
        value: /*#__PURE__*/React.createElement(AN, {
          value: s.limit,
          format: "yen"
        })
      }, {
        label: '採択率',
        value: /*#__PURE__*/React.createElement(AN, {
          value: s.adoptionRate,
          format: "percent"
        })
      }, {
        label: '残',
        value: /*#__PURE__*/React.createElement(AN, {
          value: s.daysLeft,
          suffix: "\u65E5"
        })
      }],
      onClick: () => {
        nav.set({
          selectedSubsidy: s
        });
        nav.go('detail');
      }
    }))))));
  };

  // ===== Tab roots =====
  S.ApplyRoot = function ApplyRoot({
    nav,
    app
  }) {
    if (!app.hasApplied) {
      return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(DS.NavBar, {
        title: "\u7533\u8ACB"
      }), /*#__PURE__*/React.createElement("div", {
        className: "screen"
      }, /*#__PURE__*/React.createElement(DS.EmptyState, {
        title: "\u7533\u8ACB\u4E2D\u306E\u88DC\u52A9\u91D1\u306F\u3042\u308A\u307E\u305B\u3093",
        hint: "\u8A3A\u65AD\u304B\u3089\u7533\u8ACB\u3092\u59CB\u3081\u307E\u3057\u3087\u3046"
      })));
    }
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(DS.NavBar, {
      title: "\u7533\u8ACB"
    }), /*#__PURE__*/React.createElement("div", {
      className: "screen fade"
    }, /*#__PURE__*/React.createElement("div", {
      className: "pad"
    }, /*#__PURE__*/React.createElement(DS.Card, {
      variant: "highlight",
      tappable: true,
      onClick: () => nav.go('status'),
      title: "\u4E8B\u696D\u518D\u69CB\u7BC9\u88DC\u52A9\u91D1",
      subtitle: `審査中 ・ 本日提出 ・ 受付番号 ${K.RECEIPT_NO}`
    }))));
  };
  S.MsgRoot = function MsgRoot({
    nav,
    app
  }) {
    if (!app.engaged) {
      return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(DS.NavBar, {
        title: "\u30E1\u30C3\u30BB\u30FC\u30B8"
      }), /*#__PURE__*/React.createElement("div", {
        className: "screen"
      }, /*#__PURE__*/React.createElement(DS.EmptyState, {
        title: "\u30E1\u30C3\u30BB\u30FC\u30B8\u306F\u3042\u308A\u307E\u305B\u3093",
        hint: "\u5C02\u9580\u5BB6\u306B\u4F9D\u983C\u3059\u308B\u3068\u3053\u3053\u306B\u8868\u793A\u3055\u308C\u307E\u3059"
      })));
    }
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(DS.NavBar, {
      title: "\u30E1\u30C3\u30BB\u30FC\u30B8"
    }), /*#__PURE__*/React.createElement("div", {
      className: "screen fade"
    }, /*#__PURE__*/React.createElement("div", {
      className: "pad"
    }, /*#__PURE__*/React.createElement(DS.Card, {
      tappable: true,
      onClick: () => nav.go('chat'),
      title: app.selectedExpert.name,
      subtitle: "\u30C9\u30E9\u30D5\u30C8\u304C\u3067\u304D\u307E\u3057\u305F\u3002\u3054\u78BA\u8A8D\u304A\u9858\u3044\u3057\u307E\u3059\u3002"
    }))));
  };
  S.MyPage = function MyPage({
    app
  }) {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(DS.NavBar, {
      title: "\u30DE\u30A4\u30DA\u30FC\u30B8"
    }), /*#__PURE__*/React.createElement("div", {
      className: "screen fade"
    }, /*#__PURE__*/React.createElement("div", {
      className: "pad"
    }, /*#__PURE__*/React.createElement("div", {
      className: "mp-head"
    }, /*#__PURE__*/React.createElement("div", {
      className: "mp-avatar"
    }, "C"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "mp-name"
    }, K.COMPANY_NAME), /*#__PURE__*/React.createElement("div", {
      className: "mp-mail"
    }, "contact@sample-corp.example"))), /*#__PURE__*/React.createElement("div", {
      className: "mp-row"
    }, /*#__PURE__*/React.createElement("span", null, "\u4F1A\u793E\u306EURL"), /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "sample-corp.example")), /*#__PURE__*/React.createElement("div", {
      className: "mp-row"
    }, /*#__PURE__*/React.createElement("span", null, "\u6240\u5728\u5730"), /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "\u795E\u5948\u5DDD\u770C")), /*#__PURE__*/React.createElement("div", {
      className: "mp-row"
    }, /*#__PURE__*/React.createElement("span", null, "gBizID\u30D7\u30E9\u30A4\u30E0"), /*#__PURE__*/React.createElement("span", {
      className: "v",
      style: {
        color: 'var(--blue-500)',
        fontWeight: 600
      }
    }, "\u9023\u643A\u6E08\u307F")), /*#__PURE__*/React.createElement("div", {
      className: "mp-row"
    }, /*#__PURE__*/React.createElement("span", null, "\u8A3A\u65AD\u3057\u305F\u88DC\u52A9\u91D1"), /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, app.hasApplied ? /*#__PURE__*/React.createElement(AN, {
      value: 8,
      suffix: "\u4EF6"
    }) : '0件')), /*#__PURE__*/React.createElement("div", {
      className: "mp-row"
    }, /*#__PURE__*/React.createElement("span", null, "\u901A\u77E5"), /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "\u30AA\u30F3")))));
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/hojokin-pocket/screens-diagnose.jsx", error: String((e && e.message) || e) }); }

// ui_kits/hojokin-pocket/screens-expert.jsx
try { (() => {
/* 補助金ポケット — expert (find / confirm / chat) screens */
;
(function () {
  const DS = window.DesignSystem_a96fc8;
  const K = window.KIT;
  const AN = DS.AnimatedNumber;
  const {
    useState
  } = React;
  const S = window.KIT.Screens = window.KIT.Screens || {};

  // ===== Find expert =====
  S.FindExpert = function FindExpert({
    nav,
    app
  }) {
    const s = app.selectedSubsidy;
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(DS.NavBar, {
      title: "\u5C02\u9580\u5BB6\u3092\u63A2\u3059",
      left: "\u623B\u308B",
      onLeft: () => nav.back()
    }), /*#__PURE__*/React.createElement("div", {
      className: "screen fade"
    }, /*#__PURE__*/React.createElement("div", {
      className: "pad"
    }, /*#__PURE__*/React.createElement("p", {
      className: "section-h",
      style: {
        marginBottom: 14
      }
    }, s.name, "\u306B\u5F37\u3044\u5C02\u9580\u5BB6 \u30FB ", /*#__PURE__*/React.createElement(AN, {
      value: K.EXPERTS.length,
      suffix: "\u540D"
    })), K.EXPERTS.map(ex => /*#__PURE__*/React.createElement("div", {
      key: ex.id,
      className: 'expert-card' + (ex.recommended ? ' rec' : ''),
      onClick: () => {
        nav.set({
          selectedExpert: ex
        });
        nav.go('confirm');
      }
    }, ex.recommended && /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement(DS.Badge, {
      tone: "solid"
    }, "AI\u306E\u304A\u3059\u3059\u3081")), /*#__PURE__*/React.createElement("div", {
      className: "nm"
    }, ex.name), /*#__PURE__*/React.createElement("div", {
      className: "loc"
    }, ex.area, " \u30FB ", ex.tags), /*#__PURE__*/React.createElement("div", {
      className: "rate"
    }, "\u63A1\u629E ", /*#__PURE__*/React.createElement("b", null, /*#__PURE__*/React.createElement(AN, {
      value: ex.adoptions,
      suffix: "\u4EF6"
    })), "\u3000\u8A55\u4FA1 ", /*#__PURE__*/React.createElement("b", null, /*#__PURE__*/React.createElement(AN, {
      value: ex.rating,
      decimals: 1
    }))), /*#__PURE__*/React.createElement("div", {
      className: "fee"
    }, ex.upfront, " \uFF0B \u6210\u529F\u5831\u916C ", /*#__PURE__*/React.createElement(AN, {
      value: ex.success,
      format: "percent"
    })))))));
  };

  // ===== Confirm request =====
  S.ConfirmRequest = function ConfirmRequest({
    nav,
    app
  }) {
    const ex = app.selectedExpert;
    const s = app.selectedSubsidy;
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(DS.NavBar, {
      title: "\u4F9D\u983C\u5185\u5BB9\u306E\u78BA\u8A8D",
      left: "\u623B\u308B",
      onLeft: () => nav.back()
    }), /*#__PURE__*/React.createElement("div", {
      className: "screen fade"
    }, /*#__PURE__*/React.createElement("div", {
      className: "pad"
    }, /*#__PURE__*/React.createElement("div", {
      className: "conf-block"
    }, /*#__PURE__*/React.createElement("div", {
      className: "k"
    }, "\u4F9D\u983C\u5148"), /*#__PURE__*/React.createElement("div", {
      className: "v"
    }, ex.name), /*#__PURE__*/React.createElement("div", {
      className: "s"
    }, ex.area, " \u30FB \u63A1\u629E\u5B9F\u7E3E", /*#__PURE__*/React.createElement(AN, {
      value: ex.adoptions,
      suffix: "\u4EF6"
    }))), /*#__PURE__*/React.createElement("div", {
      className: "conf-block"
    }, /*#__PURE__*/React.createElement("div", {
      className: "k"
    }, "\u5BFE\u8C61\u306E\u88DC\u52A9\u91D1"), /*#__PURE__*/React.createElement("div", {
      className: "v"
    }, s.name), /*#__PURE__*/React.createElement("div", {
      className: "s"
    }, "\u88DC\u52A9\u4E0A\u9650 ", /*#__PURE__*/React.createElement(AN, {
      value: s.limit,
      format: "yen"
    }))), /*#__PURE__*/React.createElement("div", {
      className: "conf-block"
    }, /*#__PURE__*/React.createElement("div", {
      className: "k"
    }, "\u63D0\u51FA\u3059\u308B\u66F8\u985E"), /*#__PURE__*/React.createElement("div", {
      className: "v"
    }, "\u4E8B\u696D\u8A08\u753B\u66F8\uFF08AI\u4F5C\u6210\u6E08\u307F\uFF09"), /*#__PURE__*/React.createElement("div", {
      className: "s"
    }, /*#__PURE__*/React.createElement(AN, {
      value: K.BUSINESS_PLAN.maxChars,
      format: "comma",
      suffix: "\u5B57"
    }), " \u30FB \u5C02\u9580\u5BB6\u304C\u6700\u7D42\u8ABF\u6574\u3057\u307E\u3059")), /*#__PURE__*/React.createElement("div", {
      className: "fee-box"
    }, /*#__PURE__*/React.createElement("div", {
      className: "fee-row"
    }, /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "\u7740\u624B\u91D1"), /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, ex.upfront === '着手金0円' ? /*#__PURE__*/React.createElement(AN, {
      value: 0,
      format: "yen"
    }) : /*#__PURE__*/React.createElement(AN, {
      value: 30000,
      format: "yen"
    }))), /*#__PURE__*/React.createElement("div", {
      className: "fee-row"
    }, /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "\u6210\u529F\u5831\u916C"), /*#__PURE__*/React.createElement("span", {
      className: "v blue"
    }, "\u63A1\u629E\u984D\u306E", /*#__PURE__*/React.createElement(AN, {
      value: ex.success,
      format: "percent"
    }))), /*#__PURE__*/React.createElement("div", {
      className: "fee-note"
    }, "\u63A1\u629E\u3055\u308C\u305F\u5834\u5408\u306E\u307F\u306E\u304A\u652F\u6255\u3044\u3067\u3059\u3002\u4E0D\u63A1\u629E\u306A\u3089\u8CBB\u7528\u306F\u304B\u304B\u308A\u307E\u305B\u3093\u3002")))), /*#__PURE__*/React.createElement("div", {
      className: "footer"
    }, /*#__PURE__*/React.createElement(DS.Button, {
      variant: "primary",
      onClick: () => {
        nav.set({
          engaged: true
        });
        nav.go('chat');
      }
    }, "\u3053\u306E\u5185\u5BB9\u3067\u4F9D\u983C\u3059\u308B")));
  };

  // ===== Chat =====
  const INITIAL_MSGS = [{
    who: 'sys',
    text: '事業計画書を共有しました'
  }, {
    who: 'me',
    text: 'ドラフトができました。ご確認お願いします。'
  }];
  S.Chat = function Chat({
    nav,
    app
  }) {
    const ex = app.selectedExpert;
    const [msgs, setMsgs] = useState(INITIAL_MSGS);
    const [text, setText] = useState('');
    const [replied, setReplied] = useState(false);
    const send = () => {
      if (!text.trim()) return;
      setMsgs(m => [...m, {
        who: 'me',
        text
      }]);
      setText('');
      if (!replied) {
        setReplied(true);
        setTimeout(() => setMsgs(m => [...m, {
          who: 'them',
          text: '承知しました。加点につながる箇所を調整して、提出準備まで進めますね。'
        }]), 900);
      }
    };
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(DS.NavBar, {
      title: ex.name,
      left: true,
      onLeft: () => nav.back()
    }), /*#__PURE__*/React.createElement("div", {
      className: "chat-screen"
    }, /*#__PURE__*/React.createElement("div", {
      className: "chat-body"
    }, /*#__PURE__*/React.createElement("div", {
      className: "chat-day"
    }, "\u4ECA\u65E5"), msgs.map((m, i) => m.who === 'sys' ? /*#__PURE__*/React.createElement(DS.ChatBubble, {
      key: i,
      variant: "system"
    }, m.text) : /*#__PURE__*/React.createElement(DS.ChatBubble, {
      key: i,
      from: m.who === 'them' ? 'them' : 'me'
    }, m.text))), /*#__PURE__*/React.createElement("div", {
      className: "chat-input"
    }, /*#__PURE__*/React.createElement("input", {
      placeholder: "\u30E1\u30C3\u30BB\u30FC\u30B8\u3092\u5165\u529B",
      value: text,
      onChange: e => setText(e.target.value),
      onKeyDown: e => e.key === 'Enter' && send()
    }), /*#__PURE__*/React.createElement("span", {
      className: "send",
      onClick: send
    }, "\u9001\u4FE1"))), /*#__PURE__*/React.createElement("div", {
      className: "footer",
      style: {
        paddingTop: 0
      }
    }, /*#__PURE__*/React.createElement(DS.Button, {
      variant: "primary",
      onClick: () => {
        nav.set({
          hasApplied: true
        });
        nav.go('status');
      }
    }, "\u7533\u8ACB\u72B6\u6CC1\u3078\u9032\u3080")));
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/hojokin-pocket/screens-expert.jsx", error: String((e && e.message) || e) }); }

// ui_kits/hojokin-pocket/screens-submit.jsx
try { (() => {
/* 補助金ポケット — submit (status / submit / complete) screens */
;
(function () {
  const DS = window.DesignSystem_a96fc8;
  const K = window.KIT;
  const S = window.KIT.Screens = window.KIT.Screens || {};
  const Check = ({
    size = 14
  }) => /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill: "none",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M5 12.5l4.5 4.5L19 7",
    stroke: "#fff",
    strokeWidth: "2.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }));

  // ===== Apply status (timeline) =====
  S.ApplyStatus = function ApplyStatus({
    nav,
    app
  }) {
    const s = app.selectedSubsidy;
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(DS.NavBar, {
      title: "\u7533\u8ACB\u72B6\u6CC1",
      left: true,
      onLeft: () => nav.back()
    }), /*#__PURE__*/React.createElement("div", {
      className: "screen fade"
    }, /*#__PURE__*/React.createElement("div", {
      className: "pad"
    }, /*#__PURE__*/React.createElement("div", {
      className: "tl-sub"
    }, s.name), /*#__PURE__*/React.createElement("div", {
      className: "tl-title"
    }, s.round), /*#__PURE__*/React.createElement(DS.Timeline, {
      items: K.STATUS_TIMELINE.map(i => ({
        title: i.title,
        sub: i.sub,
        state: i.state
      }))
    }))), /*#__PURE__*/React.createElement("div", {
      className: "footer"
    }, /*#__PURE__*/React.createElement(DS.Button, {
      variant: "primary",
      onClick: () => nav.go('submit')
    }, "\u7533\u8ACB\u3092\u63D0\u51FA\u3059\u308B")));
  };

  // ===== Submit (jGrants) =====
  S.Submit = function Submit({
    nav
  }) {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(DS.NavBar, {
      title: "\u7533\u8ACB\u3092\u63D0\u51FA",
      left: "\u623B\u308B",
      onLeft: () => nav.back()
    }), /*#__PURE__*/React.createElement("div", {
      className: "screen fade"
    }, /*#__PURE__*/React.createElement("div", {
      className: "pad"
    }, /*#__PURE__*/React.createElement("div", {
      className: "submit-h"
    }, /*#__PURE__*/React.createElement("span", {
      className: "jg"
    }, "jGrants"), "\u306B\u63D0\u51FA\u3057\u307E\u3059"), /*#__PURE__*/React.createElement("p", {
      className: "lead",
      style: {
        marginBottom: 12
      }
    }, "\u63D0\u51FA\u7269\u306F\u3059\u3079\u3066\u63C3\u3063\u3066\u3044\u307E\u3059\u3002"), K.SUBMIT_DOCS.map(d => /*#__PURE__*/React.createElement("div", {
      className: "doc-row",
      key: d.id
    }, /*#__PURE__*/React.createElement("span", {
      className: "cb"
    }, /*#__PURE__*/React.createElement(Check, null)), /*#__PURE__*/React.createElement("span", {
      className: "lbl"
    }, d.label), d.note && /*#__PURE__*/React.createElement("span", {
      className: "note"
    }, d.note))))), /*#__PURE__*/React.createElement("div", {
      className: "footer"
    }, /*#__PURE__*/React.createElement(DS.Button, {
      variant: "primary",
      onClick: () => nav.go('complete')
    }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
      className: "jg",
      style: {
        color: '#cfe0ff'
      }
    }, "jGrants"), "\u306B\u63D0\u51FA\u3059\u308B"))));
  };

  // ===== Complete =====
  S.Complete = function Complete({
    nav
  }) {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(DS.NavBar, {
      title: "\u63D0\u51FA\u5B8C\u4E86",
      noBorder: true
    }), /*#__PURE__*/React.createElement("div", {
      className: "complete fade"
    }, /*#__PURE__*/React.createElement("div", {
      className: "circle"
    }, /*#__PURE__*/React.createElement(Check, {
      size: 42
    })), /*#__PURE__*/React.createElement("div", {
      className: "done-h"
    }, "\u7533\u8ACB\u3092\u63D0\u51FA\u3057\u307E\u3057\u305F"), /*#__PURE__*/React.createElement("div", {
      className: "receipt"
    }, "\u53D7\u4ED8\u756A\u53F7 ", K.RECEIPT_NO), /*#__PURE__*/React.createElement("div", {
      className: "note-box"
    }, "\u5BE9\u67FB\u7D50\u679C\u306F2\u301C3\u30F6\u6708\u5F8C\u306B\u901A\u77E5\u3055\u308C\u307E\u3059\u3002", /*#__PURE__*/React.createElement("br", null), "\u9032\u6357\u306F\u30A2\u30D7\u30EA\u3067\u304A\u77E5\u3089\u305B\u3057\u307E\u3059\u3002"), /*#__PURE__*/React.createElement(DS.Button, {
      variant: "primary",
      onClick: () => {
        nav.set({
          hasApplied: true
        });
        nav.home();
      }
    }, "\u30DB\u30FC\u30E0\u306B\u623B\u308B")));
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/hojokin-pocket/screens-submit.jsx", error: String((e && e.message) || e) }); }

__ds_ns.AnimatedNumber = __ds_scope.AnimatedNumber;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.ProgressBar = __ds_scope.ProgressBar;

__ds_ns.Spinner = __ds_scope.Spinner;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.NavBar = __ds_scope.NavBar;

__ds_ns.PhoneFrame = __ds_scope.PhoneFrame;

__ds_ns.TabBar = __ds_scope.TabBar;

__ds_ns.ChatBubble = __ds_scope.ChatBubble;

__ds_ns.SubsidyRow = __ds_scope.SubsidyRow;

__ds_ns.Timeline = __ds_scope.Timeline;

})();
