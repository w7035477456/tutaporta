import { useEffect, useRef } from 'react';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';

/**
 * View-only BPMN canvas. Highlights current (blue) and completed (green) activities.
 */
export default function ClassifiedBpmnViewer({ xml, currentActivityIds = [], completedActivityIds = [] }) {
  const hostRef = useRef(null);
  const viewerRef = useRef(null);
  const lastXmlRef = useRef('');

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const viewer = new NavigatedViewer({
      container: hostRef.current,
      keyboard: { bindTo: document }
    });
    viewerRef.current = viewer;
    return () => {
      viewer.destroy();
      viewerRef.current = null;
      lastXmlRef.current = '';
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !xml) return undefined;
    let cancelled = false;

    (async () => {
      try {
        if (lastXmlRef.current !== xml) {
          await viewer.importXML(xml);
          lastXmlRef.current = xml;
          if (cancelled) return;
          const canvas = viewer.get('canvas');
          canvas.zoom('fit-viewport', 'auto');
        }
        if (cancelled) return;
        const canvas = viewer.get('canvas');
        const elementRegistry = viewer.get('elementRegistry');
        for (const el of elementRegistry.getAll()) {
          if (!el.id) continue;
          canvas.removeMarker(el.id, 'highlight-current');
          canvas.removeMarker(el.id, 'highlight-done');
        }
        for (const id of completedActivityIds) {
          if (elementRegistry.get(id)) canvas.addMarker(id, 'highlight-done');
        }
        for (const id of currentActivityIds) {
          if (elementRegistry.get(id)) canvas.addMarker(id, 'highlight-current');
        }
      } catch (err) {
        console.error('[ClassifiedBpmnViewer]', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [xml, currentActivityIds, completedActivityIds]);

  return <div ref={hostRef} className="ecsb-bpmn-host" />;
}
