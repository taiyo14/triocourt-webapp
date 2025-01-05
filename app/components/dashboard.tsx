'use client';


import SignOutButton from "./signout-button";
import { useState, useTransition } from "react";
import { AvailabilityResponse, curDate, DateForm, dateFormSchema, Slot } from "../types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { availabilityAction, deleteReservationAction, fetchReservationsAction, reserveSlotAction } from "../actions";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LoaderCircle, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import empty_file from '@/public/undraw_no-data_ig65.svg'

type DashboardProps = {
  email?: string | null
}

export default function Dashboard({
  email,
}: DashboardProps) {

  const [title, setTitle] = useState<"browse" | "reservations">("browse");

  const [isPendingReserve, startTransitionReserve] = useTransition();
  const [isPendingViewReserve, startTransitionViewReserve] = useTransition();
  const [isPendingAvail, startTransitionAvail] = useTransition();


  const [avail, setAvail] = useState<AvailabilityResponse | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [reservations, setReservations] = useState<unknown | null>(null);

  const dateForm = useForm<DateForm>({
    resolver: zodResolver(dateFormSchema),
    defaultValues: { date: curDate() },
    mode: "onBlur",
  })


  async function fetchAvail() {
    setSelectedSlot(null);
    startTransitionAvail(async () => {
      try {
        await dateForm.handleSubmit(async (dataAtSubmission: DateForm) => {
          const res = await availabilityAction(dataAtSubmission);
          if (res) setAvail(res);
        })();
      } catch (error) {
        console.error(`something went wrong.`)
      }
    })
  }

  async function handleReservation() {
    if (!selectedSlot || !avail) return;


    startTransitionReserve(async () => {
      await reserveSlotAction(selectedSlot, avail.date, avail.courtId);
      const start = selectedSlot.start;
      const index = avail.availability.findIndex(item => item.start === start);
      const a = avail.availability;
      if (a[index]) a[index] = { avail: 'occupied', start: a[index].start, end: a[index].end };

      setAvail((prev) => prev ? { ...prev, availability: a } : null);
      setSelectedSlot(null);
    })
  }

  function handleSelectSlot(slot: Slot) {
    if (slot.start === selectedSlot?.start) setSelectedSlot(null);
    else setSelectedSlot(slot);
  }


  async function handleViewReservation() {
    setReservations(null);
    setTitle("reservations");
    startTransitionViewReserve(async () => {
      const res_arr = await fetchReservationsAction();

      if (res_arr && Array.isArray(res_arr)) {
        const reserves = res_arr.filter(item => 'SK' in item && typeof item['SK'] === 'string' && item['SK'].startsWith('RESERVE#'));
        setReservations(reserves);
      }
    })
  }

  function handleDeleteReservation(id: string) {
    deleteReservationAction(id);

    // optimistically update ui
    if (Array.isArray(reservations)) {
      const newReservations = reservations.filter(reserve => reserve.SK.split('#').at(-1) !== id);
      setReservations(newReservations);
    }
  }



  return (
    <>
      {email && (
        <div className="grid justify-around gap-2 my-4">
          <span>logged in as: {email}</span>
          <SignOutButton />
        </div>
      )}

      <div className="my-4 grid justify-center">
        <div className="flex gap-4 border-2 rounded-md">
          <TitleButtons selected={title === "browse"} handleClick={() => setTitle("browse")}>Browse</TitleButtons>
          <TitleButtons selected={title === "reservations"} handleClick={handleViewReservation}>View Reservations</TitleButtons>
        </div>
      </div>

      {title === "browse" && (
        <div className="space-y-6">

          <div className="grid mx-auto max-w-36">
            <Form {...dateForm}>
              <form action={fetchAvail}>
                <FormField
                  control={dateForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormDescription>Format: YYYY-MM-DD</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button disabled={isPendingAvail} className="relative w-full mt-4">
                  {isPendingAvail && <div className="absolute bottom-1/2 left-1/2 -translate-x-1/2 translate-y-1/2"><LoaderCircle className="animate-spin" /></div>}
                  <span className={isPendingAvail ? "invisible" : ""}>Get Availability</span>
                </Button>
              </form>
            </Form>
          </div>

          <div className="max-w-2xl mx-auto rounded-md px-4">
            <div className="overflow-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted">
                    <TableHead>Courts</TableHead>
                    {cols.map(time => (
                      <TableHead key={time} className="border-l">{time}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="align-bottom border-r">#01</TableCell>
                    {avail && avail.availability && Array.isArray(avail.availability) && avail.availability.map((item, idx) => (
                      <TableCell key={idx} className="relative p-0 text-center align-bottom ">
                        <button disabled={item.avail === "unavailable" || item.avail === "occupied"}
                          onClick={() => handleSelectSlot(item)}
                          className={cn("h-full w-full border-2 border-background rounded-md p-0 hover:bg-opacity-90 absolute bottom-0 left-0",
                            item.avail === "unavailable" && "bg-slate-400",
                            item.avail === "available" && "bg-lime-500 hover:bg-lime-500/50",
                            item.avail === "occupied" && "bg-red-500",
                            item.start === selectedSlot?.start && "bg-orange-400 hover:bg-orange-400/50"
                          )}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="grid justify-center">

            {selectedSlot && (
              <div className="grid">
                <span>Selected Slot:</span>
                <span>Court: {avail?.courtId}</span>
                <span>Date: {avail?.date}</span>
                <span>Time: {`${formatTime(selectedSlot.start)} - ${formatTime(selectedSlot.end)}`}</span>
                <Button type="button" onClick={handleReservation} disabled={isPendingReserve}>
                  {isPendingReserve ? <LoaderCircle className="animate-spin" /> : "Reserve this slot"}
                </Button>
              </div>
            )}

          </div>
        </div>
      )}

      {title === "reservations" && (
        <div className="space-y-6">
          {isPendingViewReserve && (
            <div className="grid justify-center my-8">
              <LoaderCircle className="animate-spin" />
            </div>
          )}

          {Array.isArray(reservations) && (
            <div className="grid gap-4 justify-center mx-auto">
              {reservations.map((item, _idx) => (
                <Card key={item.SK.split('#').at(-1)}>
                  <CardContent className="grid p-6 relative">
                    <button type="button" className="absolute top-0 right-0 p-2" onClick={() => handleDeleteReservation(item.SK.split('#').at(-1))}>
                      <Trash2 size={17}/>
                    </button>
                    <span>Date: {item.date}</span>
                    <span>Time: {`${formatTime(item.start)} - ${formatTime(item.end)}`}</span>
                    <span>Court #: {item.courtId.split('#').at(-1)}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!isPendingViewReserve && (reservations === null || (Array.isArray(reservations) && !reservations?.length)) && (
            <div className="max-w-40 grid mx-auto text-center">
              <Image
                src={empty_file}
                alt="picture of empty files"
              />
              <p>No reservations</p>
            </div>
          )}
        </div>
      )}
    </>
  )
}

function TitleButtons({ children, selected, handleClick }: { children: string, selected?: boolean, handleClick: () => void }) {
  return (
    <Button type="button" variant="ghost"
      onClick={handleClick}
      className={cn("text-lg", selected && "underline underline-offset-4")}
    >
      {children}
    </Button>
  )
}

function formatTime(time: number, nonBreaking?: boolean) {
  const space = nonBreaking ? "\u00A0" : " ";
  if (time <= 11) return `${time}:00${space}AM`;
  if (time === 12) return `${time}:00${space}PM`;
  return `${time % 12}:00${space}PM`;
}

const cols = Array.from({ length: 14 }, (_, i) => i + 6).map((time) => formatTime(time, true));