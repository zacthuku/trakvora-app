import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { providerApi } from "@/features/provider/api/providerApi";
import { toast } from "@/components/ui/Toast";
import { MapPin, Weight, Package, Calendar, DollarSign, CheckCircle } from "lucide-react";

function BookingCard({ booking, role, onAccept, accepting }) {
  const isMover    = role === "mover";
  const isAirfreight = role === "air_freight";
  const isParcel   = role === "parcel_carrier";

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {isMover && (
            <>
              <p className="text-white font-semibold capitalize">{booking.move_type} Move</p>
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mt-1">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{booking.origin_location}</span>
                <span className="text-slate-600">→</span>
                <span className="truncate">{booking.destination_location}</span>
              </div>
            </>
          )}
          {isAirfreight && (
            <>
              <p className="text-white font-semibold">Airfreight Booking</p>
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mt-1">
                <MapPin className="w-3 h-3 shrink-0" />
                <span>{booking.port_of_origin}</span>
                <span className="text-slate-600">→</span>
                <span>{booking.port_of_destination}</span>
              </div>
            </>
          )}
          {isParcel && (
            <>
              <p className="text-white font-semibold capitalize">{booking.service_level?.replace("_", " ")} Parcel</p>
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mt-1">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{booking.pickup_location}</span>
                <span className="text-slate-600">→</span>
                <span className="truncate">{booking.dropoff_location}</span>
              </div>
            </>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-white font-heading">
            KES {(booking.price_kes ?? 0).toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Quoted price</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-slate-400">
        {isMover && booking.estimated_volume_cbm && (
          <span className="flex items-center gap-1"><Package className="w-3 h-3" />{booking.estimated_volume_cbm} CBM</span>
        )}
        {isMover && booking.move_date && (
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{booking.move_date}</span>
        )}
        {isMover && booking.requires_packing && (
          <span className="bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded border border-blue-800/50">Packing required</span>
        )}
        {isMover && booking.requires_storage && (
          <span className="bg-purple-900/40 text-purple-300 px-2 py-0.5 rounded border border-purple-800/50">Storage required</span>
        )}
        {isAirfreight && booking.cargo_weight_kg && (
          <span className="flex items-center gap-1"><Weight className="w-3 h-3" />{booking.cargo_weight_kg} kg</span>
        )}
        {isAirfreight && booking.is_dangerous_goods && (
          <span className="bg-red-900/40 text-red-300 px-2 py-0.5 rounded border border-red-800/50">Dangerous Goods</span>
        )}
        {isAirfreight && booking.expected_departure && (
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{booking.expected_departure}</span>
        )}
        {isParcel && booking.weight_kg && (
          <span className="flex items-center gap-1"><Weight className="w-3 h-3" />{booking.weight_kg} kg</span>
        )}
        {isParcel && booking.is_fragile && (
          <span className="bg-yellow-900/40 text-yellow-300 px-2 py-0.5 rounded border border-yellow-800/50">Fragile</span>
        )}
        {booking.declared_value_usd && (
          <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />USD {booking.declared_value_usd.toLocaleString()}</span>
        )}
        {booking.declared_value_kes && (
          <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />KES {booking.declared_value_kes.toLocaleString()}</span>
        )}
      </div>

      {booking.special_instructions && (
        <p className="text-xs text-slate-500 bg-slate-800/50 rounded-lg p-3 italic">
          "{booking.special_instructions}"
        </p>
      )}

      <button
        onClick={() => onAccept(booking.id)}
        disabled={accepting}
        className="w-full flex items-center justify-center gap-2 bg-[#fe6a34] hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-xl transition-colors font-heading"
      >
        <CheckCircle className="w-4 h-4" />
        {accepting ? "Accepting…" : "Accept This Job"}
      </button>
    </div>
  );
}

export default function AvailableBookingsPage() {
  const user = useAuthStore(s => s.user);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [acceptingId, setAcceptingId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["available-bookings", page],
    queryFn: () => providerApi.getAvailableBookings({ page, page_size: 20 }),
    refetchInterval: 20_000,
  });

  const { mutate: acceptBooking } = useMutation({
    mutationFn: (id) => providerApi.acceptBooking(id),
    onMutate: (id) => setAcceptingId(id),
    onSuccess: () => {
      toast("Job accepted successfully!", "success");
      queryClient.invalidateQueries({ queryKey: ["available-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["provider-stats"] });
      queryClient.invalidateQueries({ queryKey: ["provider-jobs-recent"] });
    },
    onError: (err) => {
      toast(err.response?.data?.detail ?? "Failed to accept booking", "error");
    },
    onSettled: () => setAcceptingId(null),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20) || 1;

  return (
    <div className="space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-heading">Available Jobs</h1>
          <p className="text-slate-400 text-sm mt-1">Open bookings waiting for a provider</p>
        </div>
        <span className="text-sm text-slate-500">{total} available</span>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-slate-500 text-sm">Loading available bookings…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-slate-400 text-sm">No available bookings at the moment.</p>
          <p className="text-slate-600 text-xs mt-1">Check back soon — new bookings appear here as shippers submit them.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              role={user?.role}
              onAccept={(id) => acceptBooking(id)}
              accepting={acceptingId === booking.id}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-heading">
            Previous
          </button>
          <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-heading">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
