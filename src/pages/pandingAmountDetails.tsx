import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  Title,
  Table,
  Badge,
  Button,
  Group,
  Text,
  LoadingOverlay,
  Stack,
  TextInput,
  ActionIcon,
  Select,
  ScrollArea,
} from "@mantine/core";
import { IconArrowLeft, IconSearch } from "@tabler/icons-react";
import axios from "axios";
import Cookies from "js-cookie";
import { notifyError } from "../lib/utils/notify";

function formatDateToLong(dateInput) {
  if (!dateInput) return "-";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "-";
  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "long" });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

const formatMoney = (val) => {
  const n = Number(val ?? 0);
  if (isNaN(n)) return "0.00";
  return n.toFixed(2);
};

export default function PandingAmountDetails() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Query param defaults
  const projectParam = searchParams.get("project") || "";
  const stateParam = searchParams.get("state") || "";
  const statusParam = searchParams.get("status") || "";

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState(projectParam);
  const [stateFilter, setStateFilter] = useState(stateParam);
  const [statusFilter, setStatusFilter] = useState(statusParam);

  // Project options
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
    ).map((p) => ({ value: p, label: p }));
    return [
      { value: '', label: 'All Projects' },
      ...projects
    ];
  }, [invoices]);

  // State options
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
    ).map((s) => ({ value: s, label: s }));
    return [
      { value: '', label: 'All States' },
      ...states
    ];
  }, [invoices]);


  // Status options
  const statusOptions = useMemo(() => {
    const statuses = Array.from(
      new Set(
        invoices.flatMap((inv) =>
          Array.isArray(inv.status)
            ? inv.status
            : inv.status
            ? [inv.status]
            : []
        )
      )
    ).map((s) => ({ value: s, label: s }));
    return [
      { value: '', label: 'All Statuses' },
      ...statuses
    ];
  }, [invoices]);

  // Fetch all invoices
  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const token = Cookies.get("token");
        const res = await axios.get("/api/v1/invoices", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setInvoices(Array.isArray(res.data) ? res.data : []);
      } catch {
        notifyError("Failed to load invoice details");
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, []);

  // Filter invoices: balance > 0 and match filters
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Only show invoices with pending balance
      const balance = Number(inv.balance ?? inv.netPayable ?? 0) - Number(inv.amountPaidByClient ?? 0);
      if (!(balance > 0)) return false;
      // Project filter
      if (projectFilter && projectFilter !== '' && inv.project !== projectFilter) return false;
      // State filter
      if (stateFilter && stateFilter !== '' && inv.state !== stateFilter) return false;
      // Status filter
      if (statusFilter && statusFilter !== '' && inv.status !== statusFilter) return false;
      // Search filter
      if (search && !String(inv.invoiceNumber || '').toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [invoices, projectFilter, stateFilter, statusFilter, search]);

  // Update URL query params on filter change
  useEffect(() => {
    const params = [];
    if (projectFilter) params.push(`project=${encodeURIComponent(projectFilter)}`);
    if (stateFilter) params.push(`state=${encodeURIComponent(stateFilter)}`);
    if (statusFilter) params.push(`status=${encodeURIComponent(statusFilter)}`);
    const url = params.length ? `/pending-amount-details?${params.join('&')}` : '/pending-amount-details';
    navigate(url, { replace: true });
    // eslint-disable-next-line
  }, [projectFilter, stateFilter, statusFilter]);

  return (
    <Stack>
      <LoadingOverlay visible={loading} />
      {/* Header Section */}
      <Group justify="space-between" align="flex-start" mb="md">
        <Stack gap="xs">
          <Group gap="xs">
            <Title order={2}>Pending Amount Details</Title>
            {projectFilter && projectFilter !== '' && (
              <Badge color="blue" size="lg" variant="filled">{projectFilter}</Badge>
            )}
          </Group>
          <Text c="dimmed" size="sm">
            View all invoices with a pending balance. Use the filters to refine the results.
          </Text>
        </Stack>
        <Button
          variant="subtle"
          color="gray"
          leftSection={<IconArrowLeft size={18} />}
          onClick={() => navigate('/dashboard-2')}
        >
          Back to Dashboard
        </Button>
      </Group>

      {/* Filters Section */}
      <Group gap="sm">
        <TextInput
          placeholder="Search invoice number..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          style={{ width: "200px" }}
        />
        <Select
          placeholder="Project"
          value={projectFilter}
          onChange={v => setProjectFilter(v || "")}
          data={projectOptions}
          style={{ width: 180 }}
          clearable={false}
          searchable
        />
        <Select
          placeholder="State"
          value={stateFilter}
          onChange={v => setStateFilter(v || "")}
          data={stateOptions}
          style={{ width: 180 }}
          clearable={false}
        />
        <Select
          placeholder="Status"
          value={statusFilter}
          onChange={v => setStatusFilter(v || "")}
          data={statusOptions}
          style={{ width: 140 }}
          clearable={false}
        />
      </Group>
      {filteredInvoices.length > 0 ? (
        <ScrollArea h={500}>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Invoice No.</Table.Th>
                <Table.Th>Invoice Date</Table.Th>
                <Table.Th>Project</Table.Th>
                <Table.Th>State</Table.Th>
                <Table.Th>Basic Amount (₹)</Table.Th>
                <Table.Th>GST Amount (₹)</Table.Th>
                <Table.Th>Total Amount (₹)</Table.Th>
                <Table.Th>Net Payable (₹)</Table.Th>
                <Table.Th>Amount Paid (₹)</Table.Th>
                <Table.Th>Balance (₹)</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredInvoices.map((invoice) => {
                const basicAmount = Number(invoice.basicAmount ?? invoice.invoiceBasicAmount ?? 0);
                const gstAmount = Number(invoice.gstAmount ?? invoice.invoiceGstAmount ?? 0);
                const totalAmount = Number(invoice.totalAmount ?? 0);
                const totalDeduction = Number(invoice.totalDeduction ?? 0);
                const netPayable = Number(invoice.netPayable ?? 0);
                const amountPaid = Number(invoice.amountPaidByClient ?? 0);
                const balance = Number(invoice.balance ?? invoice.netPayable ?? 0) - Number(invoice.amountPaidByClient ?? 0);
                return (
                  <Table.Tr key={invoice.id}>
                    <Table.Td>
                      <Link
                        to={`/admin-invoice/${encodeURIComponent(invoice.id || "")}`}
                        style={{ color: "#1c7ed6", textDecoration: "none", cursor: "pointer" }}
                      >
                        {invoice.invoiceNumber || "-"}
                      </Link>
                    </Table.Td>
                    <Table.Td>{formatDateToLong(invoice.invoiceDate)}</Table.Td>
                    <Table.Td>{invoice.project || '-'}</Table.Td>
                    <Table.Td>{invoice.state || '-'}</Table.Td>
                    <Table.Td>₹{formatMoney(basicAmount)}</Table.Td>
                    <Table.Td>₹{formatMoney(gstAmount)}</Table.Td>
                    <Table.Td>₹{formatMoney(totalAmount)}</Table.Td>
                    <Table.Td>₹{formatMoney(netPayable)}</Table.Td>
                    <Table.Td>₹{formatMoney(amountPaid)}</Table.Td>
                    <Table.Td>₹{formatMoney(balance)}</Table.Td>
                    <Table.Td>
                      <Badge color={
                        invoice.status === "Paid"
                          ? "#20c997"
                          : invoice.status === "Under process"
                          ? "#228be6"
                          : invoice.status === "Cancelled"
                          ? "#fa5252"
                          : "#FFBF00"
                      }>
                        {invoice.status || "-"}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      ) : (
        <Text ta="center" mt="lg" c="dimmed">
          No pending invoices found.
        </Text>
      )}
    </Stack>
  );
}