"use client";
import { useState, useEffect } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Spinner,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Tabs,
  Tab,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
} from "@heroui/react";
import {
  LineChart,
  DollarSign,
  MousePointer,
  UserPlus,
  Users,
  ChevronDownIcon,
  DownloadIcon,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { UserReports, DailyData, formatDateDisplayMDT, shouldAggregateByMonth } from "@/lib/auth";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { addToast } from "@heroui/toast";

// Consistent timezone for display (matches lib/auth TIMEZONE)
const DISPLAY_TZ = "America/Edmonton";

const formatMonthYearTZ = (ymd: string) =>
  new Date(`${ymd}T00:00:00`).toLocaleDateString("en-US", {
    timeZone: DISPLAY_TZ,
    month: "short",
    year: "numeric",
  });

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function ReportsPage() {
  const [reports, setReports] = useState<UserReports | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState("Last 30 Days");
  const [filteredData, setFilteredData] = useState<DailyData[]>([]);
  const [selectedTab, setSelectedTab] = useState("overview");
  const [retrying, setRetrying] = useState(false);

  // Function to download CSV
  const downloadCSV = () => {
    if (!filteredData || filteredData.length === 0) {
      console.log("No data to download");
      return;
    }

    // Filter data for "This Year" timeframe
    const tableData = filteredData.filter((item) => {
      const itemDate = new Date(item.date);
      const currentYear = new Date().getFullYear();

      if (selectedTimeframe === "This Year") {
        return itemDate.getFullYear() === currentYear;
      }

      return true;
    });

    // Create CSV content
    const headers = [
      shouldAggregateByMonth(selectedTimeframe) ? "Month" : "Period",
      "Earnings",
      "New Customers",
      "New Referrals",
      "Clicks Count",
    ];

    const csvContent = [
      headers.join(","),
      ...tableData
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map((item) => {
          const date = shouldAggregateByMonth(selectedTimeframe)
            ? formatMonthYearTZ(item.date)
            : formatDateDisplayMDT(item.date);

          return [
            `"${date}"`,
            `"$${item.earnings.toFixed(2)}"`,
            `"${item.newCustomers}"`,
            `"${item.newReferrals}"`,
            `"${item.clicksCount}"`,
          ].join(",");
        }),
    ].join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `reports-${selectedTimeframe.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Load reports from database
  const loadReports = async (isTimeframeChange = false) => {
    try {
      console.log("🔄 Loading reports from database...");
      if (isTimeframeChange) {
        setChartLoading(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      // Fetch raw user_reports server-side to avoid client RLS/caching
      const res = await fetch("/api/me/reports/raw", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const userReports = json?.user_reports;

      if (!userReports) throw new Error("No reports data returned from database");

      // Build the transformed structure like before using transformUserReports
      // Minimal inline transform for this page
      const overview = userReports.overview || {};
      const allDates = Object.keys(overview).sort();
      const dailyData: DailyData[] = allDates.map((dateKey: string) => ({
        date: dateKey,
        earnings: overview[dateKey]?.earnings || 0,
        newCustomers: overview[dateKey]?.customers || 0,
        newReferrals: overview[dateKey]?.signups || 0,
        clicksCount: overview[dateKey]?.clicks || 0,
      }));

      const totals = dailyData.reduce(
        (acc, d) => ({
          earnings: acc.earnings + d.earnings,
          clicks: acc.clicks + d.clicksCount,
          signups: acc.signups + d.newReferrals,
          customers: acc.customers + d.newCustomers,
        }),
        { earnings: 0, clicks: 0, signups: 0, customers: 0 }
      );

      const reportsData: UserReports = {
        overview: totals,
        dailyData,
      } as any;

      if (reportsData) {
        console.log("✅ Reports loaded:", reportsData);
        setReports(reportsData);
        setFilteredData(reportsData.dailyData || []);
      } else {
        throw new Error("No reports data returned from database");
      }
    } catch (err) {
      console.error("❌ Error loading reports:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load reports";
      setError(errorMessage);
      addToast({
        title: "Error Loading Reports",
        description: errorMessage,
        color: "danger",
      });
    } finally {
      if (isTimeframeChange) {
        setChartLoading(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    // Initial load
    if (!reports) {
      loadReports(false);
    } else {
      // Timeframe change - only load chart data
      loadReports(true);
    }
  }, [selectedTimeframe]);

  const handleRetry = async () => {
    setRetrying(true);
    await loadReports(false);
    setRetrying(false);
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner
          classNames={{ label: "text-foreground mt-4" }}
          variant="default"
          size="lg"
        />
      </div>
    );
  }

  // Show error state
  if (error || !reports) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="text-gray-500 mb-6">
            <AlertCircle size={48} className="mx-auto mb-4 text-red-500" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Error Loading Reports
            </h3>
            <p className="text-gray-600 mb-4">{error || "No reports available"}</p>
            <Button
              color="primary"
              variant="flat"
              startContent={<RefreshCw size={16} />}
              onPress={handleRetry}
              isLoading={retrying}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Calculate aggregated totals for the selected timeframe
  const getAggregatedTotals = () => {
    if (!filteredData || filteredData.length === 0) {
      return {
        earnings: reports.overview.earnings,
        clicks: reports.overview.clicks,
        signups: reports.overview.signups,
        customers: reports.overview.customers,
      };
    }

    return filteredData.reduce(
      (totals, item) => ({
        earnings: totals.earnings + item.earnings,
        clicks: totals.clicks + item.clicksCount,
        signups: totals.signups + item.newReferrals, // Using newReferrals as signups
        customers: totals.customers + item.newCustomers,
      }),
      { earnings: 0, clicks: 0, signups: 0, customers: 0 }
    );
  };

  const aggregatedTotals = getAggregatedTotals();

  // Process chart data from user_reports for overview tab only
  const processChartData = () => {
    if (!reports) {
      return {
        labels: [],
        datasets: [],
        title: "",
      };
    }

    // Use filtered data for chart (same data as table)
    if (!filteredData || filteredData.length === 0) {
      return {
        labels: [],
        datasets: [],
        title: "",
      };
    }

    // Sort data by date (oldest to newest for chart)
    const sortedData = [...filteredData].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const labels = sortedData.map((item) => {
      if (shouldAggregateByMonth(selectedTimeframe)) {
        // Month-year label pinned to DISPLAY_TZ to avoid off-by-one
        return formatMonthYearTZ(item.date);
      } else {
        // Day label using MDT helper already handles timezone
        return formatDateDisplayMDT(item.date);
      }
    });

    // Get the selected stat based on the active tab
    let selectedStat = "Earnings";
    let dataKey: keyof DailyData = "earnings";
    let borderColor = "rgb(75, 192, 192)";
    let backgroundColor = "rgba(75, 192, 192, 0.5)";

    switch (selectedTab) {
      case "Earnings":
        selectedStat = "Earnings";
        dataKey = "earnings";
        backgroundColor = "rgb(75, 192, 192)";

        break;
      case "Clicks":
        selectedStat = "Clicks";
        dataKey = "clicksCount";
        backgroundColor = "rgb(255, 99, 132)";

        break;
      case "Customers":
        selectedStat = "New Customers";
        dataKey = "newCustomers";
        backgroundColor = "rgb(54, 162, 235)";

        break;
      case "Signups":
        selectedStat = "New Referrals";
        dataKey = "newReferrals";
        backgroundColor = "rgb(255, 205, 86)";
        break;
    }

    // Create single dataset for the selected stat
    const datasets = [
      {
        label: selectedStat,
        data: sortedData.map((item) => item[dataKey]),
        borderColor: backgroundColor,
        backgroundColor: backgroundColor,
        tension: 0.125,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 5,
      },
    ];

    return {
      labels,
      datasets,
      title: `${selectedStat} - ${selectedTimeframe}`,
    };
  };

  const chartData = processChartData();

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,

    interaction: {
      mode: "nearest" as const,
      intersect: false,
      axis: "x" as const,
    },
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
    },
    scales: {
      x: {
        type: "category" as const,
        display: true,
        title: {
          display: false,
        },
        grid: {
          display: false,
        },
        ticks: {
          color: "#6B7280",
          font: {
            size: 12,
          },
          maxTicksLimit: 6, // Show only 6 labels maximum
          autoSkip: true,
        },
      },
      y: {
        type: "linear" as const,
        display: true,
        position: "left" as const,
        title: {
          display: false,
        },
        beginAtZero: true,
        grid: {
          color: "#E5E7EB",
          drawOnChartArea: false,
        },
        ticks: {
          color: "#6B7280",
          font: {
            size: 12,
          },
        },
        suggestedMin: 0,
        suggestedMax: 1,
      },
    },
  };

  const summaryStats = [
    {
      title: "Earnings",
      value: `$${aggregatedTotals.earnings.toFixed(2)}`,
      icon: DollarSign,
      highlighted: true,
    },
    {
      title: "Clicks",
      value: aggregatedTotals.clicks.toLocaleString(),
      icon: MousePointer,
      highlighted: false,
    },
    {
      title: "Signups",
      value: aggregatedTotals.signups.toLocaleString(),
      icon: UserPlus,
      highlighted: false,
    },
    {
      title: "Customers",
      value: aggregatedTotals.customers.toLocaleString(),
      icon: Users,
      highlighted: false,
    },
  ];

  const timeframeOptions = [
    "Today",
    "Yesterday",
    "Last 30 Days",
    "This Month",
    "Last Month",
    "Last 6 Months",
    "This Year",
    "All Time",
    // "Custom",
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <Button
            isIconOnly
            variant="light"
            className="text-gray-600"
            onPress={downloadCSV}
            isDisabled={!filteredData || filteredData.length === 0}
          >
            <DownloadIcon size={20} />
          </Button>
        </div>

        {/* Navigation Tabs */}
        <Tabs
          aria-label="Reports navigation"
          className="w-full p-0"
          variant="underlined"
        >
          <Tab key="overview" title="Overview">
            {/* Overview Section */}
            <div className="space-y-6">
              {/* Subtitle and Timeframe */}
              <Card className="p-0">
                <CardBody className="p-0">
                  {/* Card Header */}
                  <CardHeader className="px-6 py-4 border-b border-default/40 print:hidden panelTitle lg:!px-6 chart-panel-header flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">
                      Overview
                    </h2>
                    <div className="flex items-center gap-2">
                      <Dropdown>
                        <DropdownTrigger>
                          <Button
                            variant="light"
                            color="primary"
                            endContent={<ChevronDownIcon size={16} />}
                            className="min-w-[200px]"
                            isLoading={chartLoading}
                          >
                            <span className="text-sm font-semibold">
                              Timeframe:
                            </span>{" "}
                            {selectedTimeframe}
                          </Button>
                        </DropdownTrigger>
                        <DropdownMenu
                          aria-label="Timeframe selection"
                          disallowEmptySelection
                          selectionMode="single"
                          variant="flat"
                          selectedKeys={new Set([selectedTimeframe])}
                          onSelectionChange={(keys) => {
                            const selected = Array.from(keys)[0] as string;
                            if (selected && selected !== selectedTimeframe) {
                              setSelectedTimeframe(selected);
                            }
                          }}
                        >
                          {timeframeOptions.map((option) => (
                            <DropdownItem key={option}>{option}</DropdownItem>
                          ))}
                        </DropdownMenu>
                      </Dropdown>
                    </div>
                  </CardHeader>

                  {/* Summary Cards */}
                  <Tabs
                    placement="bottom"
                    fullWidth
                    disableAnimation
                    disableCursorAnimation
                    size="lg"
                    radius="none"
                    variant="underlined"
                    classNames={{
                      tabList:
                        "gap-0 w-full relative rounded-none p-0 border-b border-divider grid grid-cols-2 lg:grid-cols-4",
                      cursor: "w-full bg-primary",
                      tab: `text-center w-full h-20 p-0 cursor-pointer group relative`,
                      tabContent:
                        "p-0 m-0 size-full flex flex-col items-center justify-center bg-white",
                      base: "w-full h-auto",
                    }}
                    onSelectionChange={(key) => {
                      setSelectedTab(key as string);
                    }}
                  >
                    {/* Summary Cards */}
                    {summaryStats.map((stat, index) => (
                      <Tab
                        key={stat.title}
                        title={
                          <div
                            key={index}
                            className={`relative z-10 before:absolute before:bg-primary before:bottom-0 before:left-0 before:w-full before:h-1 before:transition-transform before:z-10 after:absolute after:left-0 after:bottom-0 after:w-full after:h-full after:origin-bottom  after:bg-primary-lighter after:z-0 after:transition-transform ${selectedTab === stat.title ? "bg-primary/10 before:scale-x-100 after:scale-y-100" : "bg-white before:scale-x-0 after:scale-y-0"} size-full flex flex-col items-center justify-center`}
                          >
                            <p
                              className={`text-xs font-bold group-hover:text-primary ${selectedTab === stat.title ? "text-primary" : "text-gray-400"}`}
                            >
                              {stat.title}
                            </p>
                            <p
                              className={`flex justify-center text-2xl my-2 leading-none items-center ${selectedTab === stat.title ? "text-primary" : "text-gray-900"}`}
                            >
                              {stat.value}
                            </p>
                          </div>
                        }
                      >
                        <div className="relative px-0 lg:px-6 py-auto">
                          <div className="h-48 lg:h-96">
                            {chartLoading ? (
                              <div className="flex items-center justify-center h-full">
                                <Spinner
                                  classNames={{ label: "text-foreground mt-4" }}
                                  variant="default"
                                  size="lg"
                                />
                              </div>
                            ) : (
                              <Line data={chartData} options={chartOptions} />
                            )}
                          </div>
                        </div>
                      </Tab>
                    ))}
                  </Tabs>
                </CardBody>
              </Card>
              {/* Daily Activity Table */}

              <Table aria-label="Daily activity table">
                <TableHeader>
                  <TableColumn>
                    {shouldAggregateByMonth(selectedTimeframe)
                      ? "Month"
                      : "Period"}
                  </TableColumn>
                  <TableColumn>Earnings</TableColumn>
                  <TableColumn>New Customers</TableColumn>
                  <TableColumn>New Referrals</TableColumn>
                  <TableColumn>Clicks count</TableColumn>
                </TableHeader>
                <TableBody>
                  {(filteredData || [])
                    .filter((item) => {
                      // Additional client-side filtering to ensure correct timeframe
                      const itemDate = new Date(item.date);
                      const currentYear = new Date().getFullYear();

                      if (selectedTimeframe === "This Year") {
                        return itemDate.getFullYear() === currentYear;
                      }

                      return true; // For other timeframes, trust the backend data
                    })
                    .sort(
                      (a, b) =>
                        new Date(b.date).getTime() - new Date(a.date).getTime()
                    )
                    .map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          {shouldAggregateByMonth(selectedTimeframe)
                            ? formatMonthYearTZ(item.date)
                            : formatDateDisplayMDT(item.date)}
                        </TableCell>
                        <TableCell>${item.earnings.toFixed(2)}</TableCell>
                        <TableCell>{item.newCustomers}</TableCell>
                        <TableCell>{item.newReferrals}</TableCell>
                        <TableCell>{item.clicksCount}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </Tab>
          <Tab key="links" title="Links">
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">
                <Users size={48} className="mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Links Found
                </h3>
                <p className="text-gray-600">
                  You haven't made any referrals yet. Start sharing your
                  referral link to see your links!
                </p>
              </div>
            </div>
          </Tab>
          <Tab key="traffic" title="Traffic sources">
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">
                <Users size={48} className="mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Traffic Sources Found
                </h3>
                <p className="text-gray-600">
                  You haven't made any referrals yet. Start sharing your
                  referral link to see your traffic sources!
                </p>
              </div>
            </div>
          </Tab>
          <Tab key="subids" title="Sub-Ids">
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">
                <Users size={48} className="mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Sub-Ids Found
                </h3>
                <p className="text-gray-600">
                  You haven't made any referrals yet. Start sharing your
                  referral link to see your sub-ids!
                </p>
              </div>
            </div>
          </Tab>
        </Tabs>
      </div>
    </div>
  );
}
