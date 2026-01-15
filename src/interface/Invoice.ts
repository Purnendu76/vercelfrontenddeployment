

export type Invoice = {
  items: string;
  netPayable: string | number;
  totalDeduction: string | number;
  bocw: string;
  ld: string;
  slaPenalty: string;
  penalty: string;
  otherDeduction: string;
  mybillCategory: string | null;
  lowDepthDeduction: string;
  gstTds: string;
  tds: string;
  gstWithheld: string;
  remarks: string;
  paymentDate:  Date| null;
  retention: string;
  passedAmountByClient: string;
  gstPercentage: string;
  invoiceBasicAmount: string;
  invoiceGstAmount?: number;
  submissionDate:  Date| null;
  milestone: string;
  state: string | null;
  modeOfProject: string | null;
  // project can be a single string, an array of project strings, or null
  project: string | string[] | null;
  id: string;
  invoiceNumber: string;
  invoiceDate: Date|null; // API gives string, we’ll convert
  totalAmount: number;
  amountPaidByClient: number;
  balance: number;
  status: string;
  invoice_copy_path?: string | null;
  proof_of_submission_path?: string | null;
  supporting_docs_path?: string | null;
  createdAt?: string | Date; // Added for sorting
  updatedAt?: string | Date;
};
