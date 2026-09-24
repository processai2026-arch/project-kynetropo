/**
 * The swell behind a record's identity (from mpTV-erp).
 *
 * Eighteen stroked paths that take the page's own `--primary`, so they follow
 * the deeper detail-page blue. Decoration only: `aria-hidden`, behind
 * everything. Its parent must carry `data-profile` and live inside
 * `.record-detail`, where the geometry and colour are defined.
 */
export function ProfileWaves() {
  return (
    <svg data-profile-waves="" viewBox="0 0 600 190" fill="none" aria-hidden="true">
      {Array.from({ length: 18 }, (_, i) => (
        <path
          key={i}
          d={`M0 ${105 + i * 3} C100 ${-25 + i * 4}, 155 ${195 - i}, 280 ${95 + i * 2} S430 ${-35 + i * 4}, 600 ${30 + i * 4}`}
        />
      ))}
    </svg>
  );
}

export default ProfileWaves;
