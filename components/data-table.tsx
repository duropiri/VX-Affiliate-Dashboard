"use client";

import { useMemo, useState } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Pagination,
  Button,
  Input,
  Chip,
} from "@heroui/react";
import { Download, Search, Users } from "lucide-react";
import { ReferralEvent } from "@/lib/supabase";

interface DataTableProps {
  data: ReferralEvent[];
}

const statusColorMap = {
  approved: "success",
  pending: "warning",
  rejected: "danger",
} as const;

export function DataTable({ data }: DataTableProps) {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const rowsPerPage = 10;

  const filteredData = useMemo(() => {
    return data.filter(
      (item) =>
        item.agent.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredData.slice(start, end);
  }, [filteredData, page]);

  const pages = Math.ceil(filteredData.length / rowsPerPage);

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        {/* Search Bar */}
        <div className="flex justify-between items-center">
          <Input
            placeholder="Search referrals..."
            startContent={<Search size={16} />}
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="max-w-xs"
          />
        </div>

        {/* No Referrals Found */}
        {data.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">
              <Users size={48} className="mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Referrals Found
              </h3>
              <p className="text-gray-600">
                You haven&apos;t made any referrals yet. Start sharing your referral
                link to earn commissions!
              </p>
            </div>
          </div>
        ) : (
          // Referrals Table
          <Table aria-label="Referrals table">
            <TableHeader>
              <TableColumn>AGENT</TableColumn>
              <TableColumn>EMAIL</TableColumn>
              <TableColumn>DATE</TableColumn>
              <TableColumn>STATUS</TableColumn>
            </TableHeader>
            <TableBody>
              {paginatedData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.agent}</TableCell>
                  <TableCell>{item.email}</TableCell>
                  <TableCell>
                    {new Date(item.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Chip
                      color={statusColorMap[item.status]}
                      size="sm"
                      variant="flat"
                    >
                      {item.status.charAt(0).toUpperCase() +
                        item.status.slice(1)}
                    </Chip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        <div className="flex justify-center">
          <Pagination
            total={pages}
            page={page}
            onChange={setPage}
            showControls
            showShadow
            color="primary"
          />
        </div>
      </div>
    </div>
  );
}
