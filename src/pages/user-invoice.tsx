import { useEffect, useState } from "react";
import {
  Table,
  TextInput,
  Group,
  Button,
  Modal,
  Text,
  Badge,
  Stack,
  ActionIcon,
  Loader,
  Title,
  Pagination,
  ScrollArea,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconSearch, IconPlus, IconEdit, IconTrash, IconEye } from "@tabler/icons-react";
import axios from "axios";
import InvoiceForm from "../components/InvoiceForm";
import InvoicePopup from "./InvoicePopup";
import type { Invoice } from "@/interface/Invoice";
import { modals } from "@mantine/modals";
import { notifySuccess, notifyError } from "../lib/utils/notify";
import { Link } from "react-router-dom";

/* ---------------- CONSTANTS ---------------- */
const PAGE_SIZE = 30;
const BASE_URL = import.meta.env.VITE_BASE_URL;

/* ---------------- COMPONENT ---------------- */
export default function User_invoice() {
  const [search, setSearch] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [opened, { open, close }] = useDisclosure(false);

  /* Pagination */
  const [page, setPage] = useState(1);

  /* ---------------- FETCH ---------------- */
  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const token = document.cookie
        .split("; ")
        .find((row) => row.startsWith("token="))
        ?.split("=")[1];

      if (!token) {
        notifyError("No authentication token found. Please log in again.");
        setInvoices([]);
        return;
      }

      const res = await axios.get(`${BASE_URL}/api/v1/user-invoices/project`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const normalized = res.data.map((inv: Invoice) => ({
        ...inv,
        invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate) : null,
        submissionDate: inv.submissionDate ? new Date(inv.submissionDate) : null,
        paymentDate: inv.paymentDate ? new Date(inv.paymentDate) : null,
      }));

      normalized.sort((a: Invoice, b: Invoice) => {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
      });

      setInvoices(normalized);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      notifyError("Failed to fetch invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  /* ---------------- DELETE ---------------- */
  const handleDelete = (id: string) => {
    modals.openConfirmModal({
      title: "Delete invoice",
      centered: true,
      children: <Text size="sm">Are you sure you want to delete this invoice?</Text>,
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          const token = document.cookie
            .split("; ")
            .find((row) => row.startsWith("token="))
            ?.split("=")[1];

          await axios.delete(`${BASE_URL}/api/v1/user-invoices/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          setInvoices((prev) => prev.filter((inv) => inv.id !== id));
          notifySuccess("Invoice deleted successfully");
        } catch (error) {
          console.error("Error deleting invoice:", error);
          notifyError("Failed to delete invoice");
        }
      },
    });
  };

  /* ---------------- EDIT / NEW ---------------- */
  const handleEdit = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    open();
  };

  const handleNew = () => {
    setSelectedInvoice(null);
    open();
  };

  /* ---------------- FILTER + PAGINATION ---------------- */
  const filteredInvoices = invoices.filter(
    (inv) =>
      (inv.invoiceNumber?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (inv.status?.toLowerCase() || "").includes(search.toLowerCase())
  );

  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.ceil(filteredInvoices.length / PAGE_SIZE);

  const paginatedInvoices = filteredInvoices.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  /* ---------------- HELPERS ---------------- */
  const formatMoney = (val: number | null | undefined): string => {
    const n = Number(val ?? 0);
    if (isNaN(n) || n <= 0) return "0.00";
    return n.toFixed(2);
  };

  /* ---------------- RENDER ---------------- */
  return (
    <Stack>
      <Stack gap="xs" mb="md">
        <Title order={2}>My Invoices</Title>
        <Text c="dimmed" size="sm">
          View and manage only your invoices here.
        </Text>
      </Stack>

      <Group justify="space-between" mb="md" align="center">
        <TextInput
          placeholder="Search invoices..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          w={{ base: '100%', sm: 300 }}
        />
        <Button leftSection={<IconPlus size={16} />} onClick={handleNew}>
          New Invoice
        </Button>
      </Group>

      {loading ? (
        <Loader mt="lg" />
      ) : paginatedInvoices.length === 0 ? (
        <Text ta="center" c="red" mt="lg">
          No invoices found for your account.
        </Text>
      ) : (
        <>
          <ScrollArea>
          <Table striped highlightOnHover withTableBorder style={{ minWidth: 1200 }}>
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
                <Table.Th>Action</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedInvoices.map((invoice) => {
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
                      <Link
                        to={`/user-invoice/${encodeURIComponent(invoice.id || "").toLowerCase()}`}
                        style={{ color: "#1c7ed6", textDecoration: "none" }}
                      >
                        {invoice.invoiceNumber}
                      </Link>
                    </Table.Td>
                    <Table.Td>
                      {invoice.invoiceDate
                        ? invoice.invoiceDate.toLocaleDateString()
                        : "-"}
                    </Table.Td>
                    <Table.Td>₹{formatMoney(basicAmount)}</Table.Td>
                    <Table.Td>₹{formatMoney(gstAmount)}</Table.Td>
                    <Table.Td>₹{formatMoney(totalAmount)}</Table.Td>
                    <Table.Td>₹{formatMoney(totalDeduction)}</Table.Td>
                    <Table.Td>₹{formatMoney(netPayable)}</Table.Td>
                    <Table.Td>₹{formatMoney(amountPaid)}</Table.Td>
                    <Table.Td>₹{formatMoney(balance)}</Table.Td>
                    <Table.Td>
                      <Badge
                        color={
                          invoice.status === "Paid"
                            ? "green"
                            : invoice.status === "Under process"
                            ? "yellow"
                            : invoice.status === "Credit Note Issued"
                            ? "blue"
                            : "red"
                        }
                      >
                        {invoice.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <ActionIcon
                          color="blue"
                          variant="light"
                          onClick={() => handleEdit(invoice)}
                          disabled={invoice.status === "Paid"}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          color="red"
                          variant="light"
                          onClick={() => handleDelete(invoice.id)}
                          disabled={
                            invoice.status === "Paid" ||
                            invoice.status === "Under process"
                          }
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                        <ActionIcon
                          color="green"
                          variant="light"
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setViewModalOpen(true);
                          }}
                        >
                          <IconEye size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
          </ScrollArea>

          {/* Pagination: Show only if more than 30 invoices */}
          {filteredInvoices.length > PAGE_SIZE && (
            <Group justify="center" mt="md">
              <Pagination
                value={page}
                onChange={setPage}
                total={totalPages}
                withEdges
              />
            </Group>
          )}
        </>
      )}

      {/* Modals */}
      <Modal
        size="55rem"
        opened={opened}
        onClose={close}
        title={selectedInvoice ? "Edit Invoice" : "Add New Invoice"}
        centered
        withCloseButton
        closeOnClickOutside={false}
      >
        <InvoiceForm
          onSubmit={async () => {
            await fetchInvoices();
            close();
          }}
          onClose={close}
          initialValues={selectedInvoice ?? undefined}
        />
      </Modal>

      <InvoicePopup
        opened={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        invoice={selectedInvoice}
      />
    </Stack>
  );
}
