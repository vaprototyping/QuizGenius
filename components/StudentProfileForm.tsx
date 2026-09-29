import React from 'react';
import { StudentProfile } from '../studyContext';
import { useI18n } from '../context/i18n';

interface Props {
  profile: StudentProfile;
  onChange: (profile: StudentProfile) => void;
  idPrefix: string;
}

export const StudentProfileForm: React.FC<Props> = ({ profile, onChange, idPrefix }) => {
  const { t } = useI18n();
  return <div className="student-fields">
    <label htmlFor={`${idPrefix}-age`}>{t('quizOptions.age')}<input id={`${idPrefix}-age`} type="number" min="5" max="99" inputMode="numeric" value={profile.age ?? ''} onChange={event => onChange({ ...profile, age: event.target.value === '' ? null : Number(event.target.value) })} placeholder={t('quizOptions.agePlaceholder')} /></label>
    <label htmlFor={`${idPrefix}-school`}>{t('quizOptions.schoolType')}<select id={`${idPrefix}-school`} value={profile.schoolType} onChange={event => onChange({ ...profile, schoolType: event.target.value as StudentProfile['schoolType'] })}><option value="">{t('quizOptions.chooseSchoolType')}</option>{(['primary', 'middle', 'high', 'college'] as const).map(value => <option key={value} value={value}>{t(`schoolTypes.${value}`)}</option>)}</select></label>
    <label htmlFor={`${idPrefix}-year`}>{t('quizOptions.year')}<select id={`${idPrefix}-year`} value={profile.year ?? ''} onChange={event => onChange({ ...profile, year: event.target.value ? Number(event.target.value) : null })}><option value="">{t('quizOptions.chooseYear')}</option>{Array.from({ length: 8 }, (_, index) => index + 1).map(value => <option key={value} value={value}>{t('quizOptions.yearValue', { year: value })}</option>)}</select></label>
  </div>;
};
