import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import { books, loans, students } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { addBook, loanBook, returnLoan } from "./actions";
import { Card, DataTable, Field, PageHeader, Tr, Td, inputCls, btnCls } from "@/ui/kit";

export default async function LibraryPage({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school } = await requireModule(slug, "library", ["admin", "teacher"]);
  const [bks, open] = await Promise.all([
    db.select().from(books).where(eq(books.schoolId, school.id)).orderBy(books.title),
    db.select({
      id: loans.id, loanedAt: loans.loanedAt, title: books.title,
      firstName: students.firstName, lastName: students.lastName,
    }).from(loans)
      .innerJoin(books, eq(loans.bookId, books.id))
      .innerJoin(students, eq(loans.studentId, students.id))
      .where(and(eq(loans.schoolId, school.id), isNull(loans.returnedAt))),
  ]);
  const outByBook = new Map<string, number>();
  const allOpen = await db.select().from(loans)
    .where(and(eq(loans.schoolId, school.id), isNull(loans.returnedAt)));
  for (const l of allOpen) outByBook.set(l.bookId, (outByBook.get(l.bookId) ?? 0) + 1);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Library" sub={`${bks.length} titles · ${open.length} on loan`} />
      <DataTable head={["Title", "Author", "Copies", "Available", "Loan (admission no)"]}>
        {bks.map((b) => {
          const avail = b.copies - (outByBook.get(b.id) ?? 0);
          return (
            <Tr key={b.id}>
              <Td className="font-medium">{b.title}</Td>
              <Td>{b.author ?? "—"}</Td><Td>{b.copies}</Td>
              <Td className={avail === 0 ? "text-danger" : ""}>{avail}</Td>
              <Td>
                {avail > 0 && (
                  <form action={loanBook.bind(null, slug, b.id)} className="flex gap-1">
                    <input name="admissionNo" placeholder="ADM0001"
                      className="w-24 rounded-md border border-border px-2 py-1 text-xs" />
                    <button className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">Loan</button>
                  </form>
                )}
              </Td>
            </Tr>
          );
        })}
      </DataTable>
      <h2 className="mt-6 font-semibold">On loan</h2>
      <div className="mt-2">
        <DataTable head={["Book", "Student", "Since", ""]}>
          {open.map((l) => (
            <Tr key={l.id}>
              <Td>{l.title}</Td><Td>{l.lastName}, {l.firstName}</Td><Td>{l.loanedAt}</Td>
              <Td>
                <form action={returnLoan.bind(null, slug, l.id)}>
                  <button className="rounded border border-border px-2 py-1 text-xs">Return</button>
                </form>
              </Td>
            </Tr>
          ))}
        </DataTable>
      </div>
      <Card className="mt-5">
        <form action={addBook.bind(null, slug)} className="flex items-end gap-2">
          <Field label="Title"><input name="title" required className={inputCls} /></Field>
          <Field label="Author"><input name="author" className={inputCls} /></Field>
          <Field label="Copies"><input name="copies" type="number" defaultValue={1} className={inputCls + " w-20"} /></Field>
          <button className={btnCls}>Add book</button>
        </form>
      </Card>
    </div>
  );
}
