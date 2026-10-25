import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="card center notfound">
      <div className="big-emoji">📺</div>
      <h2>404 — Офсайд!</h2>
      <p>VAR переглянув повтор з усіх ракурсів: такої сторінки не існує.</p>
      <Link to="/" className="btn primary">Повернутися на поле</Link>
    </div>
  );
}
