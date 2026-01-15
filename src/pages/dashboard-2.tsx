import React, { useState, useEffect, useMemo } from 'react';
import { Tooltip } from '@mantine/core';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Cookies from 'js-cookie';
import {
  IconCurrencyRupee,
  IconFileInvoice,
  IconCheck,
  IconClock,
  IconFilter,
  IconBell,
  IconChartBar,
  IconDashboard,
  IconX 
} from '@tabler/icons-react';
import {
  Container,
  Grid,
  Card,
  Group,
  Stack,
  Text,
  Title,
  Select,
  Table,
  Badge,
  Box,
  ThemeIcon,
  Paper,
  Avatar,
  ActionIcon,
  Divider,
  Button,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import type { Invoice } from '../interface/Invoice';
import { DonutChart } from '@mantine/charts';
import { motion } from 'framer-motion';

// --- Types & Helper Components ---

type OverdueBarChartData = { name: string; invoiceDate: number; submissionDate: number };
type OverdueBarChartProps = { data: OverdueBarChartData[]; project?: string };

// Aging periods for overdue invoices
const agingPeriods = [
  { label: '1 week', value: '1w', ms: 7 * 24 * 60 * 60 * 1000 },
  { label: '15 days', value: '15d', ms: 15 * 24 * 60 * 60 * 1000 },
  { label: '1 month', value: '1m', ms: 30 * 24 * 60 * 60 * 1000 },
  { label: '3 months', value: '3m', ms: 90 * 24 * 60 * 60 * 1000 },
  { label: '6 months', value: '6m', ms: 180 * 24 * 60 * 60 * 1000 },
];

function OverdueBarChart({ data, project = 'All Projects' }: OverdueBarChartProps) {
  if (!data || !data.length) return (<Text c="dimmed" size="sm" ta="center" py="xl">No data available</Text>);
  
  const maxRaw = Math.max(...data.map((d: OverdueBarChartData) => Math.max(d.invoiceDate, d.submissionDate))) || 1;
  
  function getNiceMax(val: number) {
    if (val <= 5) return 5;
    const pow = Math.pow(10, Math.floor(Math.log10(val)));
    const n = Math.ceil(val / pow);
    if (n <= 2) return 2 * pow;
    if (n <= 5) return 5 * pow;
    return 10 * pow;
  }
  
  const max = getNiceMax(maxRaw);
  const height = 220;
  const barWidth = 16;
  const gap = 50;
  const width = Math.max(350, data.length * (barWidth * 2 + gap) + 70);
  const yTicks = 5;
  const yStep = max / yTicks;
  const yAxisWidth = 45;
  
  return (
    <> {/* <--- THIS FRAGMENT WAS MISSING */}
      <Box style={{ overflowX: 'auto', borderRadius: '8px'}}>
        <svg width={width} height={height + 50} style={{ minWidth: '100%' }}>
          {/* Y-axis */}
          <line x1={yAxisWidth} y1={0} x2={yAxisWidth} y2={height} stroke="#d0d8df" strokeWidth={2} />
          
          {/* Y-axis lines and labels */}
          {[...Array(yTicks + 1)].map((_, i) => {
            const y = height - (i * (height / yTicks));
            return (
              <g key={i}>
                <line x1={yAxisWidth - 4} y1={y} x2={yAxisWidth} y2={y} stroke="#d0d8df" strokeWidth={1.5} />
                <line x1={yAxisWidth} y1={y} x2={width - 10} y2={y} stroke="#f1f3f5" strokeWidth={1} strokeDasharray="3,3" />
                <text
                  x={yAxisWidth - 8}
                  y={y + 4}
                  fontSize={12}
                  textAnchor="end"
                  fill="#575e68"
                  fontWeight="500"
                  style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                >
                  {Math.round(i * yStep)}
                </text>
              </g>
            );
          })}
          
          {/* Bars and tooltips */}
          {data.map((d: OverdueBarChartData, i: number) => {
            const x = yAxisWidth + 20 + i * (barWidth * 2 + gap);
            const hInv = (d.invoiceDate / max) * height;
            const hSub = (d.submissionDate / max) * height;
            const agingPeriod = agingPeriods[i];
            const timeframeValue = agingPeriod?.value || '';
            const projectParam = project === 'All Projects' ? 'all' : encodeURIComponent(project);
            
            return (
              <g key={d.name}>
                {/* Invoice Date Bar */}
                <Tooltip label={`${d.name} - Invoice Date: ${d.invoiceDate}`} position="top" withArrow>
                  <Link
                    to={`/overdue?project=${projectParam}&date=invoiceDate&timeframe=${timeframeValue}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <motion.rect
                      x={x}
                      y={height - hInv}
                      width={barWidth}
                      height={Math.max(hInv, 2)}
                      fill="#228be6"
                      rx={4}
                      transform={`translate(0,${height - hInv})`}
                      style={{ 
                        cursor: 'pointer', 
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                        transformOrigin: `0 ${hInv}` 
                      }}
                    />
                  </Link>
                </Tooltip>
                {/* Submission Date Bar */}
                <Tooltip label={`${d.name} - Submission Date: ${d.submissionDate}`} position="top" withArrow>
                  <Link
                    to={`/overdue?project=${projectParam}&date=submissionDate&timeframe=${timeframeValue}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <motion.rect
                      x={x + barWidth + 6}
                      y={height - hSub}
                      width={barWidth}
                      height={Math.max(hSub, 2)}
                      fill="#a3cff5"
                      rx={4}
                      transform={`translate(0,${height - hSub})`}
                      style={{ 
                        cursor: 'pointer', 
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                        transformOrigin: `0 ${hSub}` 
                      }}
                    />
                  </Link>
                </Tooltip>
                {/* Label */}
                <text
                  x={x + barWidth + 3}
                  y={height + 25}
                  fontSize={12}
                  textAnchor="middle"
                  fill="#495057"
                  fontWeight="500"
                  style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                >
                  {d.name}
                </text>
              </g>
            );
          })}
        </svg>
      </Box>
      
      <Group gap="lg" justify="center">
        <Group gap={8} align="center">
          <Box w={14} h={14} bg="#228be6" style={{ borderRadius: 3 }} />
          <Text size="sm" fw={500}>Invoice Date</Text>
        </Group>
        <Group gap={8} align="center">
          <Box w={14} h={14} bg="#a3cff5" style={{ borderRadius: 3 }} />
          <Text size="sm" fw={500}>Submission Date</Text>
        </Group>
      </Group>
    </>
  );
}

// Deduction labels
const deductionLabels = [
  'TDS', 'BOCW', 'Retention', 'GST Withheld', 'GST TDS', 'Low Depth Deduction', 'LD', 'SLA Penalty', 'Penalty', 'Other Deduction'
];

// Status values
const statusList = ['Paid', 'Under process', 'Credit Note Issued', 'Cancelled'];
const statusHexColors = { 'Paid': '#20c997', 'Cancelled': '#fa5252', 'Under process': '#228be6', 'Credit Note Issued': '#FFBF00' };

const projectOptions = ['All Projects', 'NFS', 'GAIL', 'BGCL', 'STP', 'BHARAT NET', 'NFS AMC'];
const stateOptions = ['All States', 'West Bengal', 'Delhi', 'Bihar', 'MP', 'Kerala', 'Sikkim', 'Jharkhand', 'Andaman'];
const billCategoryOptions = ['', 'Service', 'Supply', 'ROW', 'AMC', 'Restoration Service', 'Restoration Supply', 'Restoration Row', 'Spares', 'Training'];

function getFinancialYearOptions(currentYear = 2025, count = 5) {
  const options: { value: string; label: string; range: Date[] | null }[] = [{ value: 'all', label: 'Select Financial Year', range: null }];
  for (let i = 0; i < count; i++) {
    const startYear = currentYear - i;
    const endYear = startYear + 1;
    const label = `FY ${startYear}-${String(endYear).slice(-2)}`;
    const range = [
      new Date(`${startYear}-04-01T00:00:00.000Z`),
      new Date(`${endYear}-03-31T23:59:59.999Z`)
    ];
    options.push({ value: `${startYear}-${endYear}`, label, range });
  }
  return options;
}
const financialYearOptions = getFinancialYearOptions(2025, 5);

// 1. KPI Card
type StatCardProps = { title: string; value: string | number; icon: React.ReactNode; color: string };

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <Paper withBorder p="md" radius="md" shadow="xs">
      <Group justify="space-between">
        <div>
          <Text c="dimmed" tt="uppercase" fw={700} size="xs">{title}</Text>
          <Text fw={700} size="xl" mt="xs">₹{Number(value).toLocaleString()}</Text>
        </div>
        <ThemeIcon color={color} variant="light" size="xl" radius="md">
          {icon}
        </ThemeIcon>
      </Group>
    </Paper>
  );
}

// 2. SVG Bar Chart
type BarChartData = { name: string; raised: number; approved: number };
type BarChartProps = { data: BarChartData[] };

function BarChart({ data }: BarChartProps) {
  if (!data.length) return <Text c="dimmed" size="sm" ta="center" py="xl">No data available</Text>;
  const max = Math.max(...data.map(d => d.raised)) || 100;
  const height = 180;
  const barWidth = 14;
  const gap = 40;
  const width = Math.max(300, data.length * (barWidth * 2 + gap) + 50);

  return (
    <Box style={{ overflowX: 'auto' }}>
      <svg width={width} height={height + 30}>
        {data.map((d, i) => {
          const x = 20 + i * (barWidth * 2 + gap);
          const hRaised = (d.raised / max) * height;
          const hApproved = (d.approved / max) * height;
          return (
            <g key={d.name}>
              <line x1={x} y1={height} x2={x + barWidth*2 + 5} y2={height} stroke="#eee" strokeWidth="1" />
              <rect x={x} y={height - hRaised} width={barWidth} height={hRaised} fill="#228be6" rx={4} />
              <rect x={x + barWidth + 4} y={height - hApproved} width={barWidth} height={hApproved} fill="#a3cff5" rx={4} />
              <text x={x + barWidth} y={height + 20} fontSize={11} textAnchor="middle" fill="#868e96" style={{ fontFamily: 'sans-serif' }}>{d.name}</text>
            </g>
          );
        })}
      </svg>
      <Group justify="center" gap="md" mt="sm">
        <Group gap={6}>
          <Box w={10} h={10} bg="blue.6" style={{ borderRadius: 2 }} />
          <Text size="xs" c="dimmed">Invoice Raised</Text>
        </Group>
        <Group gap={6}>
          <Box w={10} h={10} bg="#a3cff5" style={{ borderRadius: 2 }} />
          <Text size="xs" c="dimmed">Invoice Approved</Text>
        </Group>
      </Group>
    </Box>
  );
}

// 3. Pie Chart
type PieChartData = { label: string; value: number; color: string };
type PieChartProps = { data: PieChartData[]; projectFilter?: string };

function PieChart({ data, projectFilter }: PieChartProps) {
  const chartData = (data || []).map((d) => ({ name: d.label, value: d.value, color: d.color }));
  const total = chartData.reduce((acc, d) => acc + d.value, 0);
  const chartLabel = `${total} Invoices`;
  const chartDataWithPercent = chartData.map((item) => ({
    ...item,
    percent: total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0',
  }));

  const pieProps = {
    onClick: (segment: { name: string }) => {
      if (!segment || !segment.name) return;
      const statusParam = segment.name.toLowerCase() === 'under process' ? 'Under%20Process' : encodeURIComponent(segment.name);
      let url = `/select-status?status=${statusParam}`;
      if (projectFilter && projectFilter !== 'All Projects') {
        url += `&project=${encodeURIComponent(projectFilter)}`;
      }
      window.location.href = url;
    },
    style: { cursor: 'pointer' },
  };

  return (
    <Card shadow="md" radius="md" p="md" withBorder>
      <Group mb="md">
        <ThemeIcon variant="light" color="blue" size="lg" radius="xl"><IconFileInvoice size={20} /></ThemeIcon>
        <div>
          <Title order={5} mb={0}>Invoice Status</Title>
          <Text size="xs" c="dimmed">Total invoices: {total}</Text>
        </div>
      </Group>
      <Group justify="center" mb="md">
        <DonutChart
          data={chartData} size={160} thickness={30} withLabels labelsType="value"
          paddingAngle={2} tooltipDataSource="segment" chartLabel={chartLabel}
          strokeWidth={1} pieProps={pieProps}
        />
      </Group>
      <Stack gap="xs" mt="md">
        {chartDataWithPercent.map((item, i) => (
          <Group key={i} gap={8} align="center" justify="space-between" wrap="nowrap">
            <Group gap={8} align="center" flex={1}>
              <Box w={12} h={12} bg={item.color} style={{ borderRadius: '50%', flexShrink: 0 }} />
              <Text size="sm" fw={500} truncate flex={1} tt="capitalize">{item.name}</Text>
            </Group>
            <Group gap={8} align="center" justify="flex-end" wrap="nowrap">
              <Text size="sm" fw={600}>{item.value}</Text>
              <Text size="xs" c="dimmed" fw={600} maw={35} ta="right">{item.percent}%</Text>
            </Group>
          </Group>
        ))}
      </Stack>
    </Card>
  );
}

// --- Main Dashboard Component ---

const Dashboard2 = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  // const [loading, setLoading] = useState(true); // Unused
  
  // Filter States
  const [project, setProject] = useState('All Projects');
  const [state, setState] = useState('All States');
  const [billCategory, setBillCategory] = useState('');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [financialYear, setFinancialYear] = useState('all');
  const statusOptionsList = [{ value: 'all', label: 'Status' }, ...statusList.map(s => ({ value: s, label: s }))];
  const [statusFilter, setStatusFilter] = useState<string[]>(['all']);

  // --- Check if any filter is active ---
  const isFilterActive = useMemo(() => {
    return (
      project !== 'All Projects' ||
      state !== 'All States' ||
      billCategory !== '' ||
      financialYear !== 'all' ||
      (statusFilter.length > 0 && statusFilter[0] !== 'all') ||
      (dateRange[0] !== null)
    );
  }, [project, state, billCategory, financialYear, statusFilter, dateRange]);

  // --- Clear all filters ---
  const handleClearFilters = () => {
    setProject('All Projects');
    setState('All States');
    setBillCategory('');
    setFinancialYear('all');
    setStatusFilter(['all']);
    setDateRange([null, null]);
  };

  useEffect(() => {
    const fetchInvoices = async () => {
      // setLoading(true);
      try {
        const token = Cookies.get('token');
        const res = await axios.get('/api/v1/invoices', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setInvoices(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error(err);
        setInvoices([]);
      } finally {
        // setLoading(false);
      }
    };
    fetchInvoices();
  }, []);

  const filteredInvoices = useMemo<Invoice[]>(() => {
    return invoices.filter((inv: Invoice) => {
      let match = true;
      if (project !== 'All Projects' && inv.project !== project) match = false;
      if (state !== 'All States' && inv.state !== state) match = false;
      if (billCategory && inv.mybillCategory !== billCategory) match = false;
      if (!(statusFilter.includes('all') || statusFilter.length === 0)) {
        const invStatus = String(inv.status || '').trim();
        if (!statusFilter.some(s => s === invStatus)) match = false;
      }
      if (financialYear !== 'all') {
        const fy = financialYearOptions.find(opt => opt.value === financialYear);
        if (fy && fy.range) {
          const range = fy.range as Date[];
          const invDate = inv.invoiceDate ? new Date(inv.invoiceDate).getTime() : null;
          if (!invDate || isNaN(invDate)) return false;
          if (invDate < range[0].getTime() || invDate > range[1].getTime()) match = false;
        }
      }
      if (dateRange[0] && dateRange[1]) {
        const invDate = inv.invoiceDate ? new Date(inv.invoiceDate).getTime() : null;
        if (!invDate || isNaN(invDate)) return false;
        const start = new Date(dateRange[0]);
        start.setHours(0,0,0,0);
        const end = new Date(dateRange[1]);
        end.setHours(23,59,59,999);
        if (invDate < start.getTime() || invDate > end.getTime()) match = false;
      }
      return match;
    });
  }, [invoices, project, state, billCategory, dateRange, financialYear, statusFilter]);

  const overdueByProject = useMemo<OverdueBarChartData[] | null>(() => {
    if (!(statusFilter.length === 1 && statusFilter[0] === 'Under process')) return null;
    const now = Date.now();
    const filtered = filteredInvoices.filter((inv: Invoice) => String(inv.status || '').trim() === 'Under process');
    const projectFiltered = project !== 'All Projects' ? filtered.filter((inv: Invoice) => inv.project === project) : filtered;
    
    const agingCounts: Record<string, { invoiceDate: number; submissionDate: number }> = {};
    agingPeriods.forEach(period => { agingCounts[period.label] = { invoiceDate: 0, submissionDate: 0 }; });
    
    projectFiltered.forEach((inv: Invoice) => {
      const invDate = inv.invoiceDate ? new Date(inv.invoiceDate).getTime() : null;
      if (invDate && !isNaN(invDate)) {
        const ageInMs = now - invDate;
        agingPeriods.forEach(period => { if (ageInMs >= period.ms) agingCounts[period.label].invoiceDate++; });
      }
      const subDate = inv.submissionDate ? new Date(inv.submissionDate).getTime() : null;
      if (subDate && !isNaN(subDate)) {
        const ageInMs = now - subDate;
        agingPeriods.forEach(period => { if (ageInMs >= period.ms) agingCounts[period.label].submissionDate++; });
      }
    });
    return agingPeriods.map(period => ({
      name: period.label,
      invoiceDate: agingCounts[period.label].invoiceDate,
      submissionDate: agingCounts[period.label].submissionDate,
    }));
  }, [filteredInvoices, statusFilter, project]);

  const summary = useMemo(() => {
    let basic = 0, gst = 0, paid = 0, pending = 0, totalAmount = 0;
    filteredInvoices.forEach(inv => {
      basic += Number(inv.invoiceBasicAmount || 0);
      gst += Number(inv.invoiceGstAmount || 0);
      paid += Number(inv.amountPaidByClient || 0);
      pending += Number(inv.netPayable || 0) - Number(inv.amountPaidByClient || 0);
      totalAmount += Number(inv.totalAmount || 0);
    });
    return { basic, gst, paid, pending, totalAmount };
  }, [filteredInvoices]);

  const deductionFields = useMemo(() => {
    const totals: Record<string, number> = {};
    deductionLabels.forEach(label => { totals[label] = 0; });
    filteredInvoices.forEach((inv: Invoice) => {
      totals['TDS'] += Number(inv.tds || 0);
      totals['BOCW'] += Number(inv.bocw || 0);
      totals['Retention'] += Number(inv.retention || 0);
      totals['GST Withheld'] += Number(inv.gstWithheld || 0);
      totals['GST TDS'] += Number(inv.gstTds || 0);
      totals['Low Depth Deduction'] += Number(inv.lowDepthDeduction || 0);
      totals['LD'] += Number(inv.ld || 0);
      totals['SLA Penalty'] += Number(inv.slaPenalty || 0);
      totals['Penalty'] += Number(inv.penalty || 0);
      totals['Other Deduction'] += Number(inv.otherDeduction || 0);
    });
    return deductionLabels.map(label => ({ label, value: totals[label] }));
  }, [filteredInvoices]);

  const invoiceStatus = useMemo(() => {
    const statusMap: Record<string, number> = {};
    statusList.forEach(s => { statusMap[s] = 0; });
    filteredInvoices.forEach(inv => {
      const s = String(inv.status || '').trim();
      if (Object.prototype.hasOwnProperty.call(statusMap, s)) statusMap[s]++;
    });
    return Object.entries(statusMap).map(([label, value]) => ({ label, value, color: statusHexColors[label as keyof typeof statusHexColors] }));
  }, [filteredInvoices]);

  const projectRevenue = useMemo(() => {
    const map: Record<string, { raised: number; approved: number }> = {};
    filteredInvoices.forEach(inv => {
      let mainProject = 'Unknown';
      if (Array.isArray(inv.project)) {
         mainProject = inv.project[0] || 'Unknown';
      } else {
         mainProject = inv.project || 'Unknown';
      }
      const proj = mainProject;
      if (!map[proj]) map[proj] = { raised: 0, approved: 0 };
      map[proj].raised += Number(inv.invoiceBasicAmount || 0);
      map[proj].approved += Number(inv.passedAmountByClient || 0);
    });
    return Object.entries(map).map(([name, vals]) => ({ name, ...vals }));
  }, [filteredInvoices]);

  const navigate = useNavigate();

  const handleStatCardClick = () => {
    if (project === 'All Projects') {
      navigate('/admin-invoice');
    } else {
      navigate(`/project/${encodeURIComponent(project)}`);
    }
  };

  return (
    <Box style={{ minHeight: '100vh' , width:'100%'}} >
      <Container size="100%" py="md"  >
        {/* Header Section */}
        <Paper shadow="xs" p="md" radius="md" mb="xl" withBorder>
          <Group justify="space-between" align="center">
            <Group>
               <ThemeIcon size="lg" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
                 <IconDashboard size={20} />
               </ThemeIcon>
               <Title order={3}>Financial Dashboard</Title>
            </Group>
            <Paper
              shadow="0"
              radius="md"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <Select
                placeholder="Project"
                value={project === 'All Projects' ? '' : project}
                onChange={val => setProject(val || 'All Projects')}
                data={projectOptions.map(p => ({ value: p === 'All Projects' ? '' : p, label: p }))}
                w={170}
                size="sm"
                radius="md"
                clearable={project !== 'All Projects'}
                searchable
              />
              <Select
                placeholder="State"
                value={state === 'All States' ? '' : state}
                onChange={val => setState(val || 'All States')}
                data={stateOptions.map(s => ({ value: s === 'All States' ? '' : s, label: s }))}
                w={140}
                size="sm"
                radius="md"
                clearable={state !== 'All States'}
                searchable
              />
              <Select
                placeholder="Financial Year"
                value={financialYear === 'all' ? '' : financialYear}
                onChange={val => setFinancialYear(val || 'all')}
                data={financialYearOptions.map(opt => ({ value: opt.value === 'all' ? '' : opt.value, label: opt.label }))}
                w={180}
                size="sm"
                radius="md"
                clearable={financialYear !== 'all'}
              />
              <Select
                placeholder="Status"
                value={statusFilter[0] === 'all' ? '' : statusFilter[0]}
                onChange={val => {
                  if (!val || val === 'all' || val === '') setStatusFilter(['all']);
                  else setStatusFilter([val]);
                }}
                data={statusOptionsList.map(opt => ({
                  value: opt.value === 'all' ? '' : opt.value,
                  label: String(opt.label)
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ')
                }))}
                w={150}
                size="sm"
                radius="md"
                clearable={statusFilter[0] !== 'all'}
              />
              <DatePickerInput
                type="range"
                value={dateRange}
                onChange={(val) => setDateRange(val as [Date | null, Date | null])}
                placeholder="Select date range"
                w={180}
                size="sm"
                radius="md"
                clearable
                dropdownType="modal"
                allowSingleDateInRange
                maxDate={new Date(2100, 11, 31)}
                minDate={new Date(2000, 0, 1)}
                label={null}
                disabled={financialYear !== 'all'}
              />
              
              {/* --- CLEAR BUTTON --- */}
              <Button 
                variant="subtle" 
                color="red" 
                size="sm" 
                radius="md"
                leftSection={<IconX size={16} />}
                disabled={!isFilterActive} // Disable if no filters are active
                onClick={handleClearFilters}
              >
                Clear
              </Button>
              {/* -------------------- */}

              <Divider orientation="vertical" mx={4} />
              <ActionIcon variant="light" size="lg" radius="md"><IconBell size={18} /></ActionIcon>
              <Avatar radius="xl" color="blue">AD</Avatar>
            </Paper>
          </Group>
        </Paper>

        {/* Stats Grid */}
        <Group mb="xl" gap="md" align="stretch" style={{ width: '100%', flexWrap: 'nowrap' }}>
          
          <Box style={{ cursor: 'pointer', flex: 1, minWidth: 0 }} onClick={handleStatCardClick}>
            <StatCard 
              title="Basic Invoice Value" 
              value={summary.basic} 
              icon={<IconFileInvoice size="1.2rem" />} 
              color="blue" 
            />
          </Box>

          <Box style={{ cursor: 'pointer', flex: 1, minWidth: 0 }} onClick={handleStatCardClick}>
            <StatCard 
              title="GST Amount" 
              value={summary.gst} 
              icon={<IconCurrencyRupee size="1.2rem" />} 
              color="cyan" 
            />
          </Box>

            <Box style={{ cursor: 'pointer', flex: 1, minWidth: 0 }} onClick={handleStatCardClick}>
            <StatCard 
              title="Total Invoice Amount" 
              value={summary.totalAmount} 
              icon={<IconCurrencyRupee size="1.2rem" />} 
              color="grape" 
            />
          </Box>

          <Box style={{ cursor: 'pointer', flex: 1, minWidth: 0 }} onClick={handleStatCardClick}>
            <StatCard 
              title="Total Paid" 
              value={summary.paid} 
              icon={<IconCheck size="1.2rem" />} 
              color="teal" 
            />
          </Box>
          <Box
            style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}
            onClick={() => {
              // Build query params for filters
              const params = [
                project && project !== 'All Projects' ? `project=${encodeURIComponent(project)}` : '',
                state && state !== 'All States' ? `state=${encodeURIComponent(state)}` : '',
                statusFilter && statusFilter[0] !== 'all' ? `status=${encodeURIComponent(statusFilter[0])}` : ''
              ].filter(Boolean).join('&');
              const url = params ? `/pending-amount-details?${params}` : '/pending-amount-details';
              navigate(url);
            }}
          >
            <StatCard 
              title="Pending Amount" 
              value={summary.pending} 
              icon={<IconClock size="1.2rem" />} 
              color="red" 
            />
          </Box>
        </Group>


        {/* Analytics Grid */}
        <Grid gutter="md" mb="xl" align="stretch">
          {/* Deductions Panel */}
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Card shadow="xs" radius="md" withBorder h="100%" p="sm">
              <Group mb={8} gap={6}>
                <IconFilter size={15} color="gray" />
                <Text fw={700} size="xs" tt="uppercase" c="dimmed">Bill Category</Text>
              </Group>
              <Select
                label={null}
                size="xs"
                data={billCategoryOptions.map(opt => ({ value: opt || '', label: opt || 'All' }))}
                value={billCategory === '' ? '' : billCategory}
                onChange={(v) => setBillCategory(v ?? '')}
                placeholder="Bill Category"
                mb={8}
                w="100%"
              />
              <Divider my={8} label="Deductions" labelPosition="center" />
              <Box component="table" w="100%" style={{ borderCollapse: 'collapse' }}>
                <tbody>
                  {deductionFields.map((f, i) => {
                    let statusParam = '';
                    if (Array.isArray(statusFilter) && statusFilter.length === 1 && statusFilter[0] !== 'all') {
                      statusParam = `status=${encodeURIComponent(statusFilter[0])}`;
                    }
                    const queryParams = [
                      `type=${encodeURIComponent(f.label)}`,
                      project ? `project=${encodeURIComponent(project)}` : '',
                      state ? `state=${encodeURIComponent(state)}` : '',
                      billCategory ? `billCategory=${encodeURIComponent(billCategory)}` : '',
                      financialYear && financialYear !== 'all' ? `financialYear=${encodeURIComponent(financialYear)}` : '',
                      (dateRange && dateRange[0] && dateRange[1]) ? (() => {
                        const start = new Date(dateRange[0]);
                        const end = new Date(dateRange[1]);
                        return `dateRange=${encodeURIComponent(start.toISOString())},${encodeURIComponent(end.toISOString())}`;
                      })() : '',
                      statusParam
                    ].filter(Boolean).join('&');
                    return (
                      <tr
                        key={i}
                        style={{ borderBottom: '1px solid #f1f3f5', cursor: 'pointer' }}
                        onClick={() => navigate(`/deductions?${queryParams}`)}
                      >
                        <td style={{ padding: '4px 0', fontSize: 12, color: '#868e96', textAlign: 'left', fontWeight: 500, textDecoration: 'underline' }}>{f.label}</td>
                        <td style={{ padding: '4px 0', fontSize: 12, color: '#1971c2', textAlign: 'right', fontWeight: 700 }}>₹{Number(f.value).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Box>
            </Card>
          </Grid.Col>

          {/* Revenue/Overdue Chart Panel */}
          <Grid.Col span={{ base: 12, md: 6 }}>
            {statusFilter.length === 1 && statusFilter[0] === 'Under process' && overdueByProject ? (
              <Card shadow="sm" radius="md" withBorder h="100%" p="lg">
                <Group justify="space-between" align="center" mb="md">
                  <Title order={5} mb={0}>
                    <ThemeIcon variant="light" color="blue" size="lg" radius="md" mr={10}>
                      <IconChartBar size={20} />
                    </ThemeIcon>
                    Overdue Ageing Analysis {project !== 'All Projects' && `- ${project}`}
                  </Title>
                </Group>
                <Box mt="auto" mb="auto">
                  <OverdueBarChart data={overdueByProject} project={project} />
                </Box>
              </Card>
            ) : (
              <Card shadow="sm" radius="md" withBorder h="100%" p="lg">
                <Title order={5} mb="lg">Project Revenue Analysis</Title>
                <Box mt="auto" mb="auto">
                  <BarChart data={projectRevenue} />
                </Box>
              </Card>
            )}
          </Grid.Col>

          {/* Status Pie Chart */}
          <Grid.Col span={{ base: 12, md: 3 }}>
            <PieChart data={invoiceStatus} projectFilter={project} />
          </Grid.Col>
        </Grid>

        {/* Latest Invoices Table (filtered) */}
        <Card shadow="xs" radius="md" withBorder mt="md" p="lg">
          <Group justify="space-between" align="center" mb="md">
            <Title order={5} mb={0}>Latest Invoices</Title>
            <Button
              component={Link}
              to="/admin-invoice"
              variant="outline"
              size="xs"
              color="blue"
              radius="md"
            >
              Full Details
            </Button>
          </Group>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Invoice No.</Table.Th>
                <Table.Th>Invoice Date</Table.Th>
                <Table.Th>Basic Amount (₹)</Table.Th>
                <Table.Th>GST Amount (₹)</Table.Th>
                <Table.Th>Total Amount (₹)</Table.Th>
                <Table.Th>Total Deduction (₹)</Table.Th>
                <Table.Th>Net Payable (₹)</Table.Th>
                <Table.Th>Amount Paid (₹)</Table.Th>
                <Table.Th>Balance (₹)</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(filteredInvoices || [])
                .slice()
                .sort((a, b) => {
                  const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                  const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                  return bDate - aDate;
                })
                .slice(0, 10)
                .map((invoice) => {
                const basicAmount = Number(invoice.invoiceBasicAmount ?? 0);
                const gstAmount = Number(invoice.invoiceGstAmount ?? 0);
                const totalAmount = Number(invoice.totalAmount ?? 0);
                const totalDeduction = Number(invoice.totalDeduction ?? 0);
                const netPayable = Number(invoice.netPayable ?? 0);
                const amountPaid = Number(invoice.amountPaidByClient ?? 0);
                const balance = Number(invoice.balance ?? 0);
                return (
                  <Table.Tr key={invoice.id}>
                    <Table.Td>
                      {invoice.invoiceNumber ? (
                           <Link
                          to={`/admin-invoice/${encodeURIComponent(invoice.id || "")}`}
                        style={{ color: "#1c7ed6", textDecoration: "none", cursor: "pointer" }}
                      >
                          {invoice.invoiceNumber}
                        </Link>
                      ) : "-"}
                    </Table.Td>
                    <Table.Td>{invoice.invoiceDate ? (typeof invoice.invoiceDate === 'string' ? new Date(invoice.invoiceDate).toLocaleDateString() : invoice.invoiceDate.toLocaleDateString()) : "-"}</Table.Td>
                    <Table.Td>₹{basicAmount.toFixed(2)}</Table.Td>
                    <Table.Td>₹{gstAmount.toFixed(2)}</Table.Td>
                    <Table.Td>₹{totalAmount.toFixed(2)}</Table.Td>
                    <Table.Td>₹{totalDeduction.toFixed(2)}</Table.Td>
                    <Table.Td>₹{netPayable.toFixed(2)}</Table.Td>
                    <Table.Td>₹{amountPaid.toFixed(2)}</Table.Td>
                    <Table.Td>₹{balance.toFixed(2)}</Table.Td>
                    <Table.Td>
                      <Badge
                        color={
                          invoice.status === "Paid"
                            ? "#20c997"
                            : invoice.status === "Under process"
                            ? "#228be6"
                            : invoice.status === "Cancelled"
                            ? "#fa5252"
                            : "#FFBF00"
                        }
                      >
                        {invoice.status || "-"}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Card>

        <Text c="dimmed" size="xs" ta="center" mb="md" mt="lg">
          &copy; 2025 Annu Projects. All rights reserved.
        </Text>

      </Container>
    </Box>
  );
};

export default React.memo(Dashboard2);