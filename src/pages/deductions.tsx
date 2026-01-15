import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import axios from "axios";
import { Table, Loader, Title, Text, Paper, Group, TextInput, Select, Button, Badge, Flex } from "@mantine/core";
// Status color mapping (same as dashboard)
const statusHexColors: Record<string, string> = {
  Paid: "#20c997",
  "Under process": "#228be6",
  Cancelled: "#fa5252",
  "Credit Note Issued": "#FFBF00",
};
import Cookies from "js-cookie";
import { IconSearch, IconArrowLeft, IconFilter } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import type { Invoice } from "../interface/Invoice";

const BASE_URL = import.meta.env.VITE_BASE_URL;

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const deductionFieldMap: Record<string, string> = {
  "TDS": "tds",
  "BOCW": "bocw",
  "Retention": "retention",
  "GST Withheld": "gstWithheld",
  "GST TDS": "gstTds",
  "Low Depth Deduction": "lowDepthDeduction",
  "LD": "ld",
  "SLA Penalty": "slaPenalty",
  "Penalty": "penalty",
  "Other Deduction": "otherDeduction",
};

// Financial year options (should match dashboard)
function getFinancialYearOptions(currentYear = 2025, count = 5) {
  const options: { value: string; label: string; range: Date[] | null }[] = [
    { value: 'all', label: 'Select Financial Year', range: null },
  ];
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

export default function DeductionsPage() {
  const navigate = useNavigate();
  const query = useQuery();
  const deductionType = query.get("type") || "TDS";
  const field = deductionFieldMap[deductionType] || "tds";
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const status = query.get("status") || "all";
  const [statusFilter, setStatusFilter] = useState(status);

  // Read dashboard filters from query params
  const project = query.get("project") || "all";
  const [projectFilter, setProjectFilter] = useState(project);

  const state = query.get("state") || "";
  const billCategory = query.get("billCategory") || "";
  const financialYear = query.get("financialYear") || "";
  const dateRangeStr = query.get("dateRange") || ""; // format: start,end (ISO)

  // Parse dateRange if present
  const dateRange = useMemo<[Date | null, Date | null]>(() => {
    if (dateRangeStr) {
      const [start, end] = dateRangeStr.split(",");
      return [start ? new Date(start) : null, end ? new Date(end) : null];
    }
    return [null, null];
  }, [dateRangeStr]);



  useEffect(() => {
    const fetchInvoices = async () => {
      setLoading(true);
      try {
        const token = Cookies.get("token");
        const res = await axios.get(`${BASE_URL}/api/v1/invoices`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setInvoices(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error(err);
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, [deductionType]);

  // Project options (add 'All Projects' at the top)
  const projectOptions = useMemo(() => {
    const projects = Array.from(
      new Set(
        invoices.flatMap((inv) =>
          Array.isArray(inv.project)
            ? inv.project
            : inv.project
            ? [inv.project]
            : []
        )
      )
    )
      .filter((p) => p && p !== 'all' && p !== 'All Projects')
      .map((p) => ({ value: p as string, label: p as string }));
    return [
      { value: 'all', label: 'All Projects' },
      ...projects
    ];
  }, [invoices]);

  // State options (add 'All States' at the top)
  const stateOptions = useMemo(() => {
    const states = Array.from(
      new Set(
        invoices.flatMap((inv) =>
          Array.isArray(inv.state)
            ? inv.state
            : inv.state
            ? [inv.state]
            : []
        )
      )
    )
      .filter((s) => s && s !== 'all' && s !== 'All States')
      .map((s) => ({ value: s as string, label: s as string }));
    return [
      { value: 'all', label: 'All States' },
      ...states
    ];
  }, [invoices]);

  // Status options
  const statusOptions = [
    { value: 'all', label: 'All' },
    { value: 'Paid', label: 'Paid' },
    { value: 'Under process', label: 'Under process' },
    { value: 'Credit Note Issued', label: 'Credit Note Issued' },
    { value: 'Cancelled', label: 'Cancelled' },
  ];

  // State filter state
  const [stateFilter, setStateFilter] = useState(() => {
    if (state && state !== 'all' && state !== 'All States') return state;
    return 'all';
  });

  // Mobile filter toggle
  const [filtersVisible, { toggle: toggleFilters }] = useDisclosure(false);

  // Apply dashboard filters to invoices
  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      // access dynamic field
      const val = Number(inv[field as keyof Invoice] || 0);
      if (val <= 0) return false;
      // Project filter (from filter UI)
      if (projectFilter && projectFilter !== 'all' && projectFilter !== 'All Projects' && inv.project !== projectFilter) return false;
      // Status filter (from filter UI)
      if (statusFilter !== 'all' && String(inv.status || '').trim() !== statusFilter) return false;
      // State filter (from filter UI)
      if (stateFilter && stateFilter !== 'all' && stateFilter !== 'All States' && inv.state !== stateFilter) return false;
      // Dashboard filters
      if (project && project !== 'All Projects' && project !== 'all' && inv.project !== project) return false;
      if (state && state !== 'All States' && state !== 'all' && inv.state !== state) return false;
      if (billCategory && billCategory !== 'all' && inv.mybillCategory !== billCategory) return false;
      // Financial year filter
      if (financialYear && financialYear !== 'all') {
        const fy = financialYearOptions.find(opt => opt.value === financialYear);
        if (fy && fy.range) {
          const range = fy.range as Date[];
          const invDate = inv.invoiceDate ? new Date(inv.invoiceDate).getTime() : null;
          if (!invDate || isNaN(invDate)) return false;
          if (invDate < range[0].getTime() || invDate > range[1].getTime()) return false;
        }
      }
      // Date range filter (overrides financial year if set)
      if (dateRange[0] && dateRange[1]) {
        const invDate = inv.invoiceDate ? new Date(inv.invoiceDate).getTime() : null;
        if (!invDate || isNaN(invDate)) return false;
        const start = new Date(dateRange[0]);
        start.setHours(0,0,0,0);
        const end = new Date(dateRange[1]);
        end.setHours(23,59,59,999);
        if (invDate < start.getTime() || invDate > end.getTime()) return false;
      }
      // Search filter
      if (search && !String(inv.invoiceNumber || '').toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [invoices, field, project, state, billCategory, financialYear, dateRange, projectFilter, statusFilter, stateFilter, search]);

  return (
    <Paper p="md" shadow="xs" radius="md">
      <Group justify="space-between" align="flex-start" mb="md">
        <Group>
           <Title order={3}>{deductionType} Deductions</Title>
           <Button 
             hiddenFrom="sm" 
             onClick={toggleFilters} 
             variant="outline" 
             leftSection={<IconFilter size={14} />}
             size="compact-xs"
             >
             {filtersVisible ? 'Hide' : 'Filters'}
           </Button>
        </Group>
        
        <Button
          variant="subtle"
          color="gray"
          leftSection={<IconArrowLeft size={18} />}
          onClick={() => navigate('/dashboard-2')}
        >
          Back to Dashboard
        </Button>
      </Group>
      {/* Filter UI (like Overdue page) */}
      <Flex justify="space-between" align={{base: 'stretch', sm: 'center'}} direction={{ base: 'column', sm: 'row' }} mb="md">
        <Group gap="sm" style={{ flex: 1 }} display={{ base: filtersVisible ? 'flex' : 'none', sm: 'flex' }}>
          <TextInput
            placeholder="Search invoice number..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ width: "200px" }}
            w={{ base: '100%', sm: 200 }}
          />
          <Select
            placeholder="Project"
            value={projectFilter}
            onChange={v => setProjectFilter(v || "all")}
            data={projectOptions}
            style={{ width: 180 }}
            w={{ base: '100%', sm: 180 }}
            clearable={false}
            searchable
          />
          <Select
            placeholder="State"
            value={stateFilter}
            onChange={v => setStateFilter(v || "all")}
            data={stateOptions}
            style={{ width: 180 }}
            w={{ base: '100%', sm: 180 }}
            clearable={false}
            searchable
          />
          <Select
            placeholder="Status"
            value={statusFilter}
            onChange={v => setStatusFilter(v || "all")}
            data={statusOptions}
            style={{ width: 180 }}
            w={{ base: '100%', sm: 180 }}
            clearable={false}
          />
        </Group>
      </Flex>
      {loading ? (
        <Loader />
      ) : filtered.length === 0 ? (
        <Text>No invoices found with {deductionType} deduction.</Text>
      ) : (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Invoice No.</Table.Th>
              <Table.Th visibleFrom="sm">Project</Table.Th>
              <Table.Th visibleFrom="sm">State</Table.Th>
              <Table.Th visibleFrom="sm">Invoice Date</Table.Th>
              <Table.Th>{deductionType} Amount (₹)</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filtered.map(inv => (
              <Table.Tr key={inv.id}>
                <Table.Td>
                    {inv.invoiceNumber ? 
                      (
                        <Link
                          to={`/admin-invoice/${encodeURIComponent(inv.id || "")}`}
                          style={{ color: "#1c7ed6", textDecoration: "none", cursor: "pointer" }}
                        >
                          {inv.invoiceNumber}
                        </Link>
                      ) 
                      : "-"
                    }
                </Table.Td>
                <Table.Td visibleFrom="sm">{inv.project || "-"}</Table.Td>
                <Table.Td visibleFrom="sm">{inv.state || "-"}</Table.Td>
                <Table.Td visibleFrom="sm">{inv.invoiceDate ? (() => {
                  const d = typeof inv.invoiceDate === 'string' ? new Date(inv.invoiceDate) : inv.invoiceDate;
                  if (isNaN(d.getTime())) return "-";
                  const day = d.getDate();
                  const month = d.toLocaleString('en-US', { month: 'long' });
                  const year = d.getFullYear();
                  return `${day} ${month} ${year}`;
                })() : "-"}</Table.Td>
                <Table.Td>₹{Number(inv[field as keyof Invoice] || 0).toFixed(2)}</Table.Td>
                <Table.Td>
                  <Badge
                    color={
                      statusHexColors[inv.status] || "gray"
                    }
                  >
                    {inv.status || "-"}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Paper>
  );
}