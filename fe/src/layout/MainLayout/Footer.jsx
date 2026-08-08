import ColorTemplate15ApplicationFrame from 'ui-component/ColorTemplate15ApplicationFrame';

/** Regions 5 + 6 — delegates to ColorTemplate15ApplicationFrame footer. */
export default function Footer({ inline = false }) {
  return (
    <ColorTemplate15ApplicationFrame.Footer
      inline={inline}
      showMusicControls
      showSupportButton
    />
  );
}
