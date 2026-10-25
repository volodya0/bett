import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n.jsx';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="card center notfound">
      <h2>{t('notFound.title')}</h2>
      <p>{t('notFound.text')}</p>
      <Link to="/" className="btn primary">{t('notFound.back')}</Link>
    </div>
  );
}
