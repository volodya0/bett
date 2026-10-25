import React, { useEffect, useState } from 'react';
import { api, pts } from '../api.js';
import { useI18n } from '../i18n.jsx';

// Rule texts contain only <b> from our own dictionary.
const Html = ({ as: Tag = 'span', html }) => <Tag dangerouslySetInnerHTML={{ __html: html }} />;

export default function Rules() {
  const { t } = useI18n();
  const [r, setR] = useState(null);
  useEffect(() => {
    api.get('/api/rules').then(setR);
  }, []);
  if (!r) return <div className="loading" />;

  const sum = r.wExact + r.wOutcome || 1;
  return (
    <section className="card prose">
      <h2>{t('rules.title')}</h2>
      <ol>
        <Html as="li" html={t('rules.1')} />
        <Html as="li" html={t('rules.2', { stake: r.defaultStake })} />
        <Html as="li" html={t('rules.3')} />
        <Html as="li" html={t('rules.4')} />
      </ol>
      <table className="table">
        <thead>
          <tr><th>{t('rules.colPrediction')}</th><th>{t('rules.colExample')}</th><th>{t('rules.colWeight')}</th></tr>
        </thead>
        <tbody>
          <tr><td>{t('rules.exact')}</td><td>2:1</td><td><b>{r.wExact}</b></td></tr>
          <tr><td>{t('rules.diff')}</td><td>3:2, 1:0</td><td><b>{r.wDiff}</b></td></tr>
          <tr><td>{t('rules.outcome')}</td><td>3:0, 4:1</td><td><b>{r.wOutcome}</b></td></tr>
          <tr><td>{t('rules.near')}</td><td>1:1, 2:2</td><td><b>{r.wNear}</b></td></tr>
          <tr><td>{t('rules.miss')}</td><td>0:3</td><td>0</td></tr>
        </tbody>
      </table>
      <Html
        as="p"
        html={t('rules.example', {
          wExact: r.wExact,
          wOutcome: r.wOutcome,
          a: pts(Math.round((400 * r.wExact) / sum)),
          b: pts(Math.round((400 * r.wOutcome) / sum)),
        })}
      />
      <p>{t('rules.closest')}</p>
      <p>{t('rules.cancel')}</p>
    </section>
  );
}
