import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Field,
  Method,
  Metric,
  Panel,
  Reading,
  Reset,
  Segment,
  StudyHeader,
} from "./components/bits";
import { ChartBox, Tip, axisLine, tick } from "./components/chart-box";
import { Shell } from "./components/shell";
import { num, pct } from "./lib/format";
import {
  ASSETS,
  CORR,
  FACTOR_NAMES,
  PANEL,
  RF_ANNUAL,
  assetSharpe,
  equalWeight,
  frontier,
  maxSharpe,
  optimize,
  portStats,
  randomCloud,
  shrinkMeans,
  wealthPath,
} from "./lib/markets";

const CAPS = [
  { value: "0.2", label: "20% cap" },
  { value: "0.3", label: "30% cap" },
  { value: "0.4", label: "40% cap" },
  { value: "1", label: "No cap" },
] as const;

export function App() {
  const [capKey, setCapKey] = useState<(typeof CAPS)[number]["value"]>("0.3");
  const [shrink, setShrink] = useState(0.25);
  const [picked, setPicked] = useState("LT");
  const cap = Number(capKey);
  const mu = useMemo(() => shrinkMeans(shrink), [shrink]);
  const front = useMemo(() => frontier(cap, mu), [cap, mu]);
  const best = useMemo(() => front.reduce((a, b) => (b.sharpe > a.sharpe ? b : a)), [front]);
  const [lambda, setLambda] = useState(best.lambda);
  const weights = useMemo(() => optimize(lambda, cap, mu), [lambda, cap, mu]);
  const book = useMemo(() => portStats(weights, mu), [weights, mu]);
  const sampleBook = useMemo(() => portStats(weights, PANEL.mu), [weights]);
  const cloud = useMemo(() => randomCloud(mu), [mu]);
  const equal = useMemo(() => portStats(equalWeight(), mu), [mu]);
  const atCap = weights.filter((weight) => weight > cap - 0.008 && cap < 0.99).length;

  const wealth = useMemo(() => {
    const opt = wealthPath(weights);
    const flat = wealthPath(equalWeight());
    return opt.map((point, index) => ({
      month: point.month,
      Optimized: point.wealth,
      "Equal weight": flat[index]!.wealth,
    }));
  }, [weights]);

  const betas = ASSETS.map((asset, index) => ({
    ticker: asset.ticker,
    Estimated: PANEL.regs[index]!.beta[1]!,
    "Known beta": asset.beta[0],
  }));

  const pickedIndex = Math.max(
    0,
    ASSETS.findIndex((asset) => asset.ticker === picked),
  );
  const reg = PANEL.regs[pickedIndex]!;
  const asset = ASSETS[pickedIndex]!;
  const coefNames = ["Alpha", ...FACTOR_NAMES];

  const scatterFront = front
    .map((point) => ({ vol: point.vol * 100, ret: point.ret * 100 }))
    .sort((a, b) => a.vol - b.vol);

  return (
    <Shell project="NSE factor book">
      <StudyHeader
        kicker="Portfolio and factors"
        title="NSE factor book"
        lede="Sixty simulated months. Ten familiar Indian large-cap labels. Four factors: market, size, value, momentum. The returns are not a historical tape. They are drawn from a known model plus noise, so a regression can be checked against the betas that generated it. The book is long-only mean-variance on that sample."
      />

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Expected return"
          value={pct(book.ret)}
          hint={`Shrunk means. Raw sample mean of these weights is ${pct(sampleBook.ret)}.`}
        />
        <Metric
          label="Volatility"
          value={pct(book.vol)}
          hint="Annualised from the sample covariance."
        />
        <Metric
          label="Sharpe"
          value={book.sharpe.toFixed(2)}
          hint={`Equal weight on the same means is ${equal.sharpe.toFixed(2)}. Risk-free ${pct(RF_ANNUAL, 1)}.`}
          tone="teal"
        />
        <Metric
          label="Names at the cap"
          value={cap > 0.99 ? "—" : String(atCap)}
          hint={cap > 0.99 ? "No position limit." : `Cap is ${pct(cap, 0)} of the book.`}
          tone={atCap >= 3 ? "rust" : "ink"}
        />
      </div>

      <div className="mt-8">
        <Reading title="What the book is actually doing">
          Mean-variance on a sixty-month sample buys the names that won the window. Shrinkage of{" "}
          {pct(shrink, 0)} pulls every mean toward the cross-sectional average before the optimizer
          runs; at zero it does not pull at all, and the cap is the only thing stopping a one-name
          book. The Sharpe above is an in-sample Sharpe. The wealth chart below is the same sample
          the weights were fit on. That is a description of the estimator, not evidence it will work
          next year. Risk aversion λ is {lambda.toFixed(1)}. The highest Sharpe on this frontier
          sits at λ {best.lambda.toFixed(1)}.
        </Reading>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-2xl">Construction</h2>
            <Reset
              label="Max Sharpe"
              onClick={() => {
                setLambda(best.lambda);
              }}
            />
          </div>
          <Field
            label="Risk aversion λ"
            value={lambda}
            min={0.6}
            max={50}
            step={0.2}
            display={lambda.toFixed(1)}
            onChange={setLambda}
          />
          <Field
            label="Shrink the means"
            value={shrink}
            min={0}
            max={1}
            step={0.05}
            display={pct(shrink, 0)}
            onChange={setShrink}
          />
          <Segment label="Position cap" value={capKey} options={[...CAPS]} onChange={setCapKey} />
          <button
            type="button"
            className="mt-3 min-h-11 border border-line px-3 text-sm text-ink"
            onClick={() => {
              setCapKey("0.3");
              setShrink(0.25);
              setLambda(maxSharpe(0.3, shrinkMeans(0.25)).lambda);
            }}
          >
            Reset case
          </button>
          <ul className="mt-4">
            {ASSETS.map((name, index) => (
              <li key={name.ticker} className="border-t border-line py-2">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{name.ticker}</span>
                  <span className="tabular-nums text-teal">{pct(weights[index] ?? 0, 1)}</span>
                </div>
                <div className="mt-1 h-1.5 bg-paper-2">
                  <div
                    className="h-1.5 bg-teal"
                    style={{ width: `${Math.round((weights[index] ?? 0) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-8">
          <Panel title="Risk and return">
            <ChartBox>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-line)" />
                  <XAxis
                    type="number"
                    dataKey="vol"
                    name="Volatility"
                    tick={tick}
                    axisLine={axisLine}
                    tickLine={false}
                    tickFormatter={(value: number) => `${value.toFixed(0)}%`}
                  />
                  <YAxis
                    type="number"
                    dataKey="ret"
                    tick={tick}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value: number) => `${value.toFixed(0)}%`}
                    width={40}
                  />
                  <Tooltip
                    content={(props) => (
                      <Tip
                        active={props.active}
                        payload={props.payload?.map((row) => ({
                          name: String(row.name ?? ""),
                          value: Number(row.value),
                        }))}
                        format={(value) => `${value.toFixed(1)}%`}
                      />
                    )}
                  />
                  <Scatter
                    name="Random long-only"
                    data={cloud.map((point) => ({ vol: point.vol * 100, ret: point.ret * 100 }))}
                    fill="var(--color-muted)"
                    isAnimationActive={false}
                  />
                  <Scatter
                    name="Frontier"
                    data={scatterFront}
                    fill="var(--color-teal)"
                    line
                    lineJointType="monotone"
                    isAnimationActive={false}
                  />
                  <ReferenceDot
                    x={book.vol * 100}
                    y={book.ret * 100}
                    r={6}
                    fill="var(--color-ink)"
                  />
                  <ReferenceDot
                    x={equal.vol * 100}
                    y={equal.ret * 100}
                    r={5}
                    fill="var(--color-rust)"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </ChartBox>
            <p className="mt-2 text-sm text-muted">
              Percent. Dots are random long-only books. The teal line is the capped frontier under
              the shrunk means. Ink is this book. Rust is equal weight.
            </p>
          </Panel>
          <div className="mt-10">
            <Panel title="In-sample wealth of ₹1">
              <ChartBox className="h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={wealth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--color-line)" vertical={false} />
                    <XAxis
                      dataKey="month"
                      ticks={[0, 12, 24, 36, 48, 60]}
                      tick={tick}
                      axisLine={axisLine}
                      tickLine={false}
                    />
                    <YAxis tick={tick} axisLine={false} tickLine={false} width={36} />
                    <Tooltip
                      content={(props) => (
                        <Tip
                          active={props.active}
                          label={
                            typeof props.label === "number" ? `Month ${props.label}` : props.label
                          }
                          payload={props.payload?.map((row) => ({
                            name: String(row.name ?? ""),
                            value: Number(row.value),
                          }))}
                          format={(value) => value.toFixed(2)}
                        />
                      )}
                    />
                    <Line
                      type="monotone"
                      dataKey="Optimized"
                      stroke="var(--color-teal)"
                      dot={false}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="Equal weight"
                      stroke="var(--color-ink)"
                      dot={false}
                      strokeWidth={1.5}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartBox>
              <p className="mt-2 text-sm text-muted">
                Same sixty months the covariance and the means came from. A line that beats equal
                weight here has not been tested.
              </p>
            </Panel>
          </div>
        </div>
      </div>

      <div className="mt-12">
        <Panel title="Does the regression recover the market beta?">
          <ChartBox>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={betas} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis
                  dataKey="ticker"
                  tick={tick}
                  axisLine={axisLine}
                  tickLine={false}
                  interval={0}
                  angle={-40}
                  textAnchor="end"
                  height={72}
                />
                <YAxis tick={tick} axisLine={false} tickLine={false} width={32} />
                <Tooltip
                  content={(props) => (
                    <Tip
                      active={props.active}
                      label={props.label}
                      payload={props.payload?.map((row) => ({
                        name: String(row.name ?? ""),
                        value: Number(row.value),
                      }))}
                      format={(value) => value.toFixed(2)}
                    />
                  )}
                />
                <Bar dataKey="Estimated" fill="var(--color-teal)" isAnimationActive={false} />
                <Bar dataKey="Known beta" fill="var(--color-ink)" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
          <p className="mt-2 text-sm text-muted">
            Teal is the OLS slope on the market factor. Ink is the beta that generated the series.
            Sixty months is enough to get the sign and the neighbourhood, not a second decimal.
          </p>
        </Panel>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <h2 className="text-2xl">One name</h2>
          <div className="mt-3 flex flex-wrap gap-1">
            {ASSETS.map((name) => {
              const on = name.ticker === asset.ticker;
              return (
                <button
                  key={name.ticker}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked(name.ticker)}
                  className={
                    on
                      ? "min-h-11 bg-ink px-3 text-sm text-paper"
                      : "min-h-11 border border-line px-3 text-sm text-muted"
                  }
                >
                  {name.ticker}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-muted">
            {asset.name} · {asset.sector}. Annualised sample return{" "}
            {pct(PANEL.annReturn[pickedIndex]!)}, volatility {pct(PANEL.annVol[pickedIndex]!)},
            Sharpe {assetSharpe(pickedIndex).toFixed(2)}. Regression R² {pct(reg.r2, 0)}.
          </p>
        </div>
        <div className="overflow-x-auto lg:col-span-8">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead className="text-xs tracking-widest text-muted uppercase">
              <tr>
                {["Term", "Estimate", "Std. error", "t", "Known value"].map((heading) => (
                  <th key={heading} className="py-2 pr-3 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {coefNames.map((name, index) => {
                const estimate = reg.beta[index]!;
                const shown = index === 0 ? estimate * 12 : estimate;
                const known = index === 0 ? asset.alpha * 12 : asset.beta[index - 1]!;
                const significant = Math.abs(reg.t[index]!) >= 1.96;
                return (
                  <tr key={name} className="border-t border-line">
                    <td className="py-2 pr-3">{name}</td>
                    <td className="py-2 pr-3">{index === 0 ? pct(shown) : num(shown)}</td>
                    <td className="py-2 pr-3">
                      {index === 0 ? pct(reg.se[index]! * 12) : num(reg.se[index]!)}
                    </td>
                    <td className={`py-2 pr-3 ${significant ? "text-ink" : "text-muted"}`}>
                      {num(reg.t[index]!, 1)}
                    </td>
                    <td className="py-2 pr-3 text-muted">
                      {index === 0 ? pct(known) : num(known)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-sm text-muted">
            Alpha is annualised for the table; its t-statistic is the monthly one. A t past 1.96 is
            set in ink. Known value is the data-generating parameter, which a real tape would not
            hand you.
          </p>
        </div>
      </div>

      <div className="mt-12">
        <Panel title="The ten names">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="text-xs tracking-widest text-muted uppercase">
                <tr>
                  {[
                    "Ticker",
                    "Sector",
                    "Return",
                    "Vol",
                    "Sharpe",
                    "β est.",
                    "β known",
                    "α ann.",
                    "t(α)",
                    "R²",
                    "Weight",
                  ].map((heading) => (
                    <th key={heading} className="py-2 pr-3 font-medium">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {ASSETS.map((name, index) => {
                  const fit = PANEL.regs[index]!;
                  return (
                    <tr key={name.ticker} className="border-t border-line">
                      <td className="py-2 pr-3">{name.ticker}</td>
                      <td className="py-2 pr-3">{name.sector}</td>
                      <td className="py-2 pr-3">{pct(PANEL.annReturn[index]!)}</td>
                      <td className="py-2 pr-3">{pct(PANEL.annVol[index]!)}</td>
                      <td className="py-2 pr-3">{assetSharpe(index).toFixed(2)}</td>
                      <td className="py-2 pr-3">{num(fit.beta[1]!)}</td>
                      <td className="py-2 pr-3 text-muted">{num(name.beta[0])}</td>
                      <td className="py-2 pr-3">{pct(fit.beta[0]! * 12)}</td>
                      <td className="py-2 pr-3">{num(fit.t[0]!, 1)}</td>
                      <td className="py-2 pr-3">{pct(fit.r2, 0)}</td>
                      <td className="py-2 pr-3">{pct(weights[index] ?? 0, 1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="mt-12">
        <Panel title="Correlation">
          <div className="overflow-x-auto">
            <div
              className="grid min-w-[36rem] gap-px text-center text-xs tabular-nums"
              style={{ gridTemplateColumns: `4.5rem repeat(${ASSETS.length}, minmax(2rem, 1fr))` }}
            >
              <span />
              {ASSETS.map((name) => (
                <span key={name.ticker} className="truncate px-1 text-muted">
                  {name.ticker.slice(0, 4)}
                </span>
              ))}
              {ASSETS.map((rowName, i) => (
                <div key={rowName.ticker} className="contents">
                  <span className="truncate pr-2 text-left text-muted">{rowName.ticker}</span>
                  {ASSETS.map((colName, j) => {
                    const value = CORR[i]![j]!;
                    const mix = Math.round(Math.abs(value) * 100);
                    const pigment = value >= 0 ? "var(--color-teal)" : "var(--color-rust)";
                    return (
                      <span
                        key={colName.ticker}
                        className="flex min-h-8 items-center justify-center text-ink"
                        style={{
                          background: `color-mix(in oklab, ${pigment} ${mix}%, var(--color-paper))`,
                        }}
                        title={`${rowName.ticker} / ${colName.ticker}: ${value.toFixed(2)}`}
                      >
                        {value.toFixed(1)}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-8">
        <Method title="Method">
          <p>
            Each month, four correlated factor premia are drawn and each name returns the risk-free
            rate plus an alpha, plus its betas times those premia, plus Gaussian idiosyncratic
            noise. OLS is ordinary, with an intercept, on excess returns. Standard errors assume
            spherical residuals. Annual means are monthly means times twelve. The covariance used by
            the optimizer is the sample covariance times twelve.
          </p>
          <p>
            The optimizer maximises expected return minus λ/2 times variance, on the probability
            simplex, with an optional upper bound. It is projected gradient with backtracking.
            Shrinkage replaces each sample mean μᵢ with (1 − a) μᵢ + a μ̄. The frontier is that
            problem on a grid of λ. Sharpe uses a {pct(RF_ANNUAL, 1)} risk-free rate. Nothing here
            is a downloaded NSE series, and the tickers are labels.
          </p>
          <p>
            Sample factor means, annualised:{" "}
            {FACTOR_NAMES.map(
              (name, index) => `${name} ${pct(PANEL.factorMean[index]! * 12)}`,
            ).join(", ")}
            . The generating means were 8.6%, 1.7%, 2.5% and 3.4%.
          </p>
        </Method>
      </div>
    </Shell>
  );
}
