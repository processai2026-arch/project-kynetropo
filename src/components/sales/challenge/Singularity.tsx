/**
 * Singularity — the accretion disk, counter-rotating inner disk, event horizon
 * and polar jets at the centre of the collapse.
 *
 * Purely presentational: it knows nothing about challenges, deadlines or state.
 * All motion lives in challenge-destroy.css so nothing is animated from JS.
 */
export function Singularity() {
  return (
    <div className="kyn-destroy__singularity" aria-hidden="true">
      <div className="kyn-destroy__disk" />
      <div className="kyn-destroy__disk kyn-destroy__disk--inner" />
      <div className="kyn-destroy__horizon">
        <span className="kyn-destroy__jet kyn-destroy__jet--top" />
        <span className="kyn-destroy__jet kyn-destroy__jet--bottom" />
      </div>
    </div>
  );
}

export default Singularity;
