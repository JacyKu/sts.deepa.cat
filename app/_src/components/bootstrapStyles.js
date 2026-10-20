// Bootstrap's grid and utility classes (row/col-*, d-flex, justify-content-*,
// fw-bold, ...) are used only by the builder, so its stylesheet is loaded only
// on the builder routes instead of every page. Rendered with a `precedence` so
// React 19 hoists it into <head> and dedupes it.
export default function BootstrapStyles() {
    return (
        <link
            rel="stylesheet"
            precedence="default"
            href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.0-beta1/dist/css/bootstrap.min.css"
            integrity="sha384-0evHe/X+R7YkIZDRvuzKMRqM+OrBnVFBL6DOitfPri4tjfHxaWutUpFmBp4vmVor"
            crossOrigin="anonymous"
        />
    );
}
