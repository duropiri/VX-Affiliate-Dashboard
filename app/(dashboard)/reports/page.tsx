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
  DollarSign,
  MousePointer,
  UserPlus,
  Users,
  ChevronDownIcon,
  DownloadIcon,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
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

import {
  UserReports,
  DailyData,
  formatDateDisplayMDT,
  shouldAggregateByMonth,
  transformUserReports,
} from "@/lib/auth";

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
  Legend,
);

export default function ReportsPage() {
  const [rawReports, setRawReports] = useState<any>(null);
  const [reports, setReports] = useState<UserReports | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState("Last 30 Days");
  const [selectedTab, setSelectedTab] = useState("overview");
  const [retrying, setRetrying] = useState(false);

  // Function to download CSV
  const downloadCSV = () => {
    if (!reports?.dailyData || reports.dailyData.length === 0) {
      return;
    }

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
      ...reports.dailyData
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
      `reports-${selectedTimeframe.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Load reports from database
  const loadReports = async (isTimeframeChange = false) => {
    try {
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

      if (!userReports)
        throw new Error("No reports data returned from database");

      // Store raw reports data
      setRawReports(userReports);

      // Transform the data using the proper timeframe filtering
      const transformedReports = transformUserReports(
        userReports,
        selectedTimeframe,
      );

      if (transformedReports) {
        setReports(transformedReports);
      } else {
        throw new Error("Failed to transform reports data");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load reports";

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

  // Update reports when timeframe changes
  useEffect(() => {
    if (rawReports) {
      // If we have raw data, just transform it with the new timeframe
      const transformedReports = transformUserReports(
        rawReports,
        selectedTimeframe,
      );

      setReports(transformedReports);
      setChartLoading(false);
    } else {
      // Initial load
      loadReports(false);
    }
  }, [selectedTimeframe]);

  // Initial load
  useEffect(() => {
    if (!rawReports) {
      loadReports(false);
    }
  }, []);

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
          size="lg"
          variant="default"
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
            <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Error Loading Reports
            </h3>
            <p className="text-gray-600 mb-4">
              {error || "No reports available"}
            </p>
            <Button
              color="primary"
              isLoading={retrying}
              startContent={<RefreshCw size={16} />}
              variant="flat"
              onPress={handleRetry}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Process chart data from transformed reports
  const processChartData = () => {
    if (!reports?.dailyData || reports.dailyData.length === 0) {
      return {
        labels: [],
        datasets: [],
        title: "",
      };
    }

    // Sort data by date (oldest to newest for chart)
    const sortedData = [...reports.dailyData].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
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
      value: `$${reports.overview.earnings.toFixed(2)}`,
      icon: DollarSign,
      highlighted: true,
    },
    {
      title: "Clicks",
      value: reports.overview.clicks.toLocaleString(),
      icon: MousePointer,
      highlighted: false,
    },
    {
      title: "Signups",
      value: reports.overview.signups.toLocaleString(),
      icon: UserPlus,
      highlighted: false,
    },
    {
      title: "Customers",
      value: reports.overview.customers.toLocaleString(),
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
            className="text-gray-600"
            isDisabled={!reports?.dailyData || reports.dailyData.length === 0}
            variant="light"
            onPress={downloadCSV}
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
                            className="min-w-[200px]"
                            color="primary"
                            endContent={<ChevronDownIcon size={16} />}
                            isLoading={chartLoading}
                            variant="light"
                          >
                            <span className="text-sm font-semibold">
                              Timeframe:
                            </span>{" "}
                            {selectedTimeframe}
                          </Button>
                        </DropdownTrigger>
                        <DropdownMenu
                          disallowEmptySelection
                          aria-label="Timeframe selection"
                          selectedKeys={new Set([selectedTimeframe])}
                          selectionMode="single"
                          variant="flat"
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
                    disableAnimation
                    disableCursorAnimation
                    fullWidth
                    classNames={{
                      tabList:
                        "gap-0 w-full relative rounded-none p-0 border-b border-divider grid grid-cols-2 lg:grid-cols-4",
                      cursor: "w-full bg-primary",
                      tab: `text-center w-full h-20 p-0 cursor-pointer group relative`,
                      tabContent:
                        "p-0 m-0 size-full flex flex-col items-center justify-center bg-white",
                      base: "w-full h-auto",
                    }}
                    placement="bottom"
                    radius="none"
                    size="lg"
                    variant="underlined"
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
                                  size="lg"
                                  variant="default"
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
                  {(reports.dailyData || [])
                    .sort(
                      (a, b) =>
                        new Date(b.date).getTime() - new Date(a.date).getTime(),
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
                <Users className="mx-auto mb-4" size={48} />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Links Found
                </h3>
                <p className="text-gray-600">
                  You haven&apos;t made any referrals yet. Start sharing your
                  referral link to see your links!
                </p>
              </div>
            </div>
          </Tab>
          <Tab key="traffic" title="Traffic sources">
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">
                <Users className="mx-auto mb-4" size={48} />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Traffic Sources Found
                </h3>
                <p className="text-gray-600">
                  You haven&apos;t made any referrals yet. Start sharing your
                  referral link to see your traffic sources!
                </p>
              </div>
            </div>
          </Tab>
          <Tab key="subids" title="Sub-Ids">
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">
                <Users className="mx-auto mb-4" size={48} />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Sub-Ids Found
                </h3>
                <p className="text-gray-600">
                  You haven&apos;t made any referrals yet. Start sharing your
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
