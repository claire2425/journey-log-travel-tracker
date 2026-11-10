export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-semibold tracking-[0.2em] text-teal-700">YOUR TRAVEL, YOUR DEVICE</p>
      <h1 className="mt-3 text-5xl font-bold tracking-tight">Journey Log</h1>
      <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600 dark:text-slate-300">
        Private, local-first records for flights and rail journeys. Your trips will stay on this device.
      </p>
      <p className="mt-8 text-sm text-slate-500">Coming next: add a trip, browse your map, and see your travel story.</p>
    </main>
  );
}
