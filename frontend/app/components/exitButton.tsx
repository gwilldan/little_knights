import { Link } from "react-router";

export default function ExitButton() {
  return (
   <Link
    to={"/"}
              className="lk-modal-close"
              type="button"
            >
              ×
            </Link>
  )
}
