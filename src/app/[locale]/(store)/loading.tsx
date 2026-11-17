/** Shown instantly while the next page streams in, so a tap always gets an immediate visual response. */
export default function Loading() {
  return (
    <div className="container-x py-10" aria-busy="true">
      <div className="skeleton h-12 w-2/3 max-w-md" />
      <div className="skeleton mt-4 h-5 w-1/2 max-w-sm" />
      <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i}>
            <div className="skeleton aspect-[4/5]" />
            <div className="skeleton mt-3 h-4 w-3/4" />
            <div className="skeleton mt-2 h-4 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
