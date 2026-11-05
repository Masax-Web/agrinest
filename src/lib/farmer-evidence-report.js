import { calculateFarmerTrust } from './farmer-trust.js';

export function buildFarmerEvidenceReport({ profile = {}, records = {}, options = {} }) {
  const fields = Array.isArray(records.fields) ? records.fields : [];
  const activities = Array.isArray(records.activities) ? records.activities : [];
  const groups = Array.isArray(records.groups) ? records.groups : [];
  const trust = calculateFarmerTrust(profile);

  const report = {
    documentType: 'AGRI-NEST farmer-entered evidence summary',
    generatedAt: new Date().toISOString(),
    verificationNotice: 'This report is compiled from farmer-entered and device-recorded information. AGRI-NEST has not independently verified identity, land ownership, crop production, photos, GPS data, group membership, creditworthiness, or repayment history.',
    profileCompleteness: {
      score: trust.score,
      maximum: 1000,
      tier: trust.tier,
      categories: trust.categories.map(({ label, percent }) => ({ label, percent })),
      notice: 'This is a profile-completeness measure only, not a credit score or lending recommendation.',
    },
    recordCounts: {
      ...(options.includeFarmDetails ? { fields: fields.length } : {}),
      ...(options.includeActivitySummary ? {
        farmActivities: activities.filter((activity) => activity.module === 'activity').length,
        activitiesWithPhoto: activities.filter((activity) => activity.module === 'activity' && Boolean(activity.photo)).length,
        activitiesWithGpsStamp: activities.filter((activity) => activity.module === 'activity' && Boolean(activity.gpsStamp)).length,
      } : {}),
      ...(options.includeGroupNames ? { groupRecords: groups.length } : {}),
    },
    includedSections: [],
    excludedSensitiveFields: ['National ID numbers', 'Bank account details', 'Authentication credentials'],
  };

  if (options.includeIdentity) {
    report.farmer = {
      name: profile.name || '',
      region: profile.region || '',
      cooperative: profile.cooperative || '',
    };
    report.includedSections.push('farmer');
  }

  if (options.includeLocation) {
    report.farmLocation = {
      location: profile.location || '',
      city: profile.city || '',
      district: profile.district || '',
      region: profile.region || '',
      latitude: profile.latitude || '',
      longitude: profile.longitude || '',
    };
    report.includedSections.push('farmLocation');
  }

  if (options.includeFarmDetails) {
    report.fields = fields.map((field) => ({
      name: field.name || '',
      crop: field.crop || '',
      areaAcres: Number(field.area) || 0,
      recordStatus: 'Farmer-entered; not independently verified',
    }));
    report.includedSections.push('fields');
  }

  if (options.includeActivitySummary) {
    report.farmActivities = activities
      .filter((activity) => activity.module === 'activity')
      .map((activity) => ({
        activity: activity.category || activity.title || 'Farm activity',
        date: activity.date || '',
        field: activity.fieldName || '',
        photoAttached: Boolean(activity.photo),
        photoTimestamp: activity.photoAddedAt || '',
        gpsAccuracyMeters: Number(activity.gpsStamp?.accuracy) || null,
        gpsStampedAt: activity.gpsStamp?.stampedAt || '',
        ...(options.includeLocation && activity.gpsStamp ? {
          gpsLatitude: Number(activity.gpsStamp.latitude),
          gpsLongitude: Number(activity.gpsStamp.longitude),
        } : {}),
        recordStatus: 'Farmer-entered/device-recorded; not tamper-proof or independently verified',
      }));
    report.includedSections.push('farmActivities');
  }

  if (options.includeGroupNames) {
    report.groups = groups.map((group) => ({
      name: group.name || '',
      region: group.region || '',
      recordStatus: 'Farmer account record; group endorsement not verified',
    }));
    report.includedSections.push('groups');
  }

  return report;
}
