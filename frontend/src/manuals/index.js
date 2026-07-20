import { normalizePageKey, PAGE_TITLES, ROLE_LABELS, resolveManualRoleTabs } from './roles';
import { sharedManuals } from './shared';
import { adminManuals } from './admin';
import { superAdminManuals } from './super_admin';
import { officeTechManuals } from './office_tech';
import { maTechManuals } from './ma_tech';
import { salesManuals } from './sales';

const ROLE_MANUALS = {
  super_admin: superAdminManuals,
  admin: adminManuals,
  office_tech: officeTechManuals,
  ma_tech: maTechManuals,
  sales: salesManuals,
  guest: {},
};

function sectionSearchText(section) {
  const parts = [section.heading, section.body];
  if (section.steps) parts.push(...section.steps);
  if (section.tips) parts.push(...section.tips);
  if (section.faqs) {
    section.faqs.forEach((f) => {
      parts.push(f.q, f.a);
    });
  }
  return parts.filter(Boolean).join(' ').toLowerCase();
}

/** Filter sections by search query (case-insensitive, Thai-friendly) */
export function filterManualSections(manual, query) {
  if (!manual) return null;
  const q = String(query || '').trim().toLowerCase();
  if (!q) return manual;
  const sections = (manual.sections || []).filter((s) => sectionSearchText(s).includes(q));
  return { ...manual, sections };
}

function lookupPageManual(roleKey, pageKey) {
  if (sharedManuals[pageKey] && (roleKey === 'guest' || pageKey === 'login')) {
    return sharedManuals[pageKey];
  }
  const pack = ROLE_MANUALS[roleKey] || {};
  if (pack[pageKey]) return pack[pageKey];
  // Fallback shared report for all roles
  if (pageKey === 'report' && sharedManuals.report) return sharedManuals.report;
  if (pageKey === 'login' && sharedManuals.login) return sharedManuals.login;
  return null;
}

/**
 * Get manuals for each role tab the user should see on this page.
 * @returns {{ pageKey: string, pageTitle: string, tabs: Array<{ roleKey, label, manual }> }}
 */
export function getManual(userRoles = [], pageName = 'dashboard') {
  const pageKey = normalizePageKey(pageName);
  const pageTitle = PAGE_TITLES[pageKey] || 'หน้านี้';
  const roleTabs = pageKey === 'login' ? ['guest'] : resolveManualRoleTabs(userRoles);

  const tabs = roleTabs.map((roleKey) => {
    const manual = lookupPageManual(roleKey, pageKey);
    return {
      roleKey,
      label: ROLE_LABELS[roleKey] || roleKey,
      manual: manual
        ? { ...manual, title: manual.title || pageTitle }
        : null,
    };
  });

  // If all tabs empty but shared login/report exists, still useful
  if (!tabs.some((t) => t.manual) && sharedManuals[pageKey]) {
    return {
      pageKey,
      pageTitle,
      tabs: [
        {
          roleKey: 'guest',
          label: ROLE_LABELS.guest,
          manual: sharedManuals[pageKey],
        },
      ],
    };
  }

  return { pageKey, pageTitle, tabs };
}

export { normalizePageKey, PAGE_TITLES, ROLE_LABELS, resolveManualRoleTabs };
