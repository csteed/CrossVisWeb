var pcpChart = function () {
    let margin = {
        top: 20,
        right: 10,
        bottom: 20,
        left: 10
    };
    let width = 800 - margin.left - margin.right;
    let height = 300 - margin.top - margin.bottom;
    let titleText = "";
    let selectedLineOpacity = 0.15;
    let unselectedLineOpacity = 0.05;
    let selectedLineColor = 'steelblue';
    let unselectedLineColor = 'gray';
    let showSelected = true;
    let showUnselected = true;

    let tuples;
    let svg;
    let foreground;
    let background;
    let selected;
    let unselected;
    let dimensions;
    let x;
    let y = {};
    let canvasMargin = 6;
    let axisBarWidth = 16;
    let selectionIndicatorHeight = 40;
    let pcpHeight;

    function chart(selection, data) {
        tuples = data.tuples.slice();
        dimensions = data.dimensions.slice();
        
        pcpHeight = height - selectionIndicatorHeight;

        const backgroundCanvas = selection.append('canvas')
            .attr('id', 'background')
            .attr('width', width + canvasMargin * 2)
            .attr('height', pcpHeight + canvasMargin * 2)
            .style('position', 'absolute')
            .style('top', `${margin.top - canvasMargin}px`)
            .style('left', `${margin.left - canvasMargin}px`)
        background = backgroundCanvas.node().getContext('2d');
        // background.strokeStyle = "rgba(0,0,0)";
        background.strokeStyle = unselectedLineColor;
        background.globalAlpha = unselectedLineOpacity;
        background.antialias = false;
        background.lineWidth = 1;
        background.translate(canvasMargin + 0.5, canvasMargin + 0.5);

        const foregroundCanvas = selection.append('canvas')
            .attr('id', 'foreground')
            .attr('width', width + canvasMargin * 2)
            .attr('height', pcpHeight + canvasMargin * 2)
            .style('position', 'absolute')
            .style('top', `${margin.top - canvasMargin}px`)
            .style('left', `${margin.left - canvasMargin}px`)
        foreground = foregroundCanvas.node().getContext('2d');
        // foreground.strokeStyle = "rgba(0,100,160)";
        foreground.strokeStyle = selectedLineColor;
        foreground.globalAlpha = selectedLineOpacity;
        foreground.antialias = true;
        foreground.lineWidth = 1.5;
        foreground.translate(canvasMargin + 0.5, canvasMargin + 0.5);

        svg = selection.append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .style('position', 'absolute')
            .append('svg:g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        svg.append("text")
            .attr("x", width / 2)
            .attr("y", -30)
            .style("text-anchor", "middle")
            .style("font-weight", "bold")
            .style("font-size", "12")
            .text(titleText);

        x = d3.scalePoint().range([0, width]).padding(.25);
                
        let dimensionNames = [];
        dimensions.map(dim => {
            dimensionNames.push(dim.name);
            if (dim.type === 'numerical') {
                y[dim.name] = d3.scaleLinear()
                    .domain(d3.extent(tuples, d => d[dim.name])).nice();
            } else if (dim.type === 'categorical') {
                const domain = [...new Set(tuples.map(d => d[dim.name]))].sort(d3.descending);
                y[dim.name] = d3.scaleBand().domain(domain).paddingInner(0.1);
            } else if (dim.type === 'temporal') {
                y[dim.name] = d3.scaleTime()
                    .domain(d3.extent(tuples, d => d[dim.name])).nice();
            }

            if (y[dim.name]) {
                y[dim.name].range([pcpHeight, 0])
            }

            if (dim.type === 'categorical') {
                dim.groups = d3.group(tuples, d => d[dim.name]);
            } else {
                dim.bins = d3.bin()
                    .value(d => d[dim.name])
                    (tuples);
            }
            // dim.bins = d3.histogram()
            //     .value(d => d[dim.name])
            //     .domain(y[dim.name].domain())
            //     (tuples);
        });
        x.domain(dimensionNames);
        console.log(dimensions);

        svg.append("rect")
            .attr("y", pcpHeight)
            .attr("height", selectionIndicatorHeight)
            .attr("width", width)
            .style("stroke", "#000")
            .style("fill", "none");

        svg.append("text")
            .attr("class", "selection_indicator_label")
            .attr("x", width - 2)
            .attr("y", pcpHeight + 14 + selectionIndicatorHeight / 2)
            .attr("text-anchor", "end")
            .style("font-size", "12")
            .style("font-family", "sans-serif")
            .text(`0 / ${tuples.length} (0.0%) Tuples Selected`);
        
        svg.append("line")
            .attr("x1", 0)
            .attr("x2", width)
            .attr("y1", pcpHeight + selectionIndicatorHeight / 2)
            .attr("y2", pcpHeight + selectionIndicatorHeight / 2)
            .style("stroke", unselectedLineColor)
            .style("stroke-width", "2")
            .style("stroke-linecap", "round");

        svg.append("line")
            .attr("class", "selection_indicator_line")
            .attr("x1", 0)
            .attr("x2", width)
            .attr("y1", pcpHeight + selectionIndicatorHeight / 2)
            .attr("y2", pcpHeight + selectionIndicatorHeight / 2)
            .style("stroke", selectedLineColor)
            .style("stroke-width", "4")
            .style("stroke-linecap", "round");

        // Add a group element for each dimension.
        const g = svg.selectAll(".dimension")
            .data(dimensions)
            .enter().append("g")
            .attr("class", "dimension")
            .attr("transform", function (d) {
                return `translate(${x(d.name)})`;
            });

        // drawHistogramBins();
        drawDimensions();
        selectTuples();
        drawLines();
    }

    function drawHistogramBins () {
        svg.selectAll(".dimension").append("g")
            .attr("class", "binRect")
            .each(function (dim) {
                const histogramScale = d3.scaleLinear()
                    .range([0, dimensionScale.bandwidth()/2])
                    .domain([0, d3.max(dim.bins, d => d.length)]);
                d3.select(this).append("g")
                    .attr('fill', 'lightgray')
                    .attr('fill-opacity', 0.3)
                    .attr('stroke', 'gray')
                    .selectAll('rect')
                    .data(dim.bins)
                    .join('rect')
                        .attr('x', d => valueScale[dim.name](d.x0) + 1)
                        .attr('width', d => Math.max(0, valueScale[dim.name](d.x1) - valueScale[dim.name](d.x0) - 1))
                        .attr('y', d => -histogramScale(d.length))
                        .attr('height', d => histogramScale(d.length) - histogramScale(0))
                        .append('title')
                            .text(d => `[${d.x0}, ${d.x1}]\nCount: ${d.length}`);
            })
        
    }

    function drawDimensions () {
        const axis = d3.axisLeft();

        const g = svg.selectAll(".dimension");

        // Add an axis and title.
        g.append("g")
            .attr("class", "axis")
            .each(function (dim) {
                if (dim.type === 'numerical' || dim.type === 'temporal') {
                    d3.select(this).call(axis.scale(y[dim.name]).ticks(pcpHeight / 20));
                } else {
                    let color = d3.scaleSequentialSqrt([0, 1], d3.interpolateBlues)
                    // let currentY = 0;
                    // d3.select(this).call(axis.scale(y[dim.name]));
                    // const categoryRectHeight = y[dim.name].bandwidth();
                    dim.groups.forEach((grp, key) => {
                        // let grpHeight = (grp.length / tuples.length) * height;
                        grp.center = y[dim.name](key) + (y[dim.name].bandwidth() / 2);
                        d3.select(this).append("rect")
                            .attr("class", "categoryRect")
                            // .attr("fill", "lightgray")
                            .attr("fill", color(grp.length / tuples.length))
                            .attr("stroke", "gray")
                            .attr("stroke-width", 0.7)
                            // .attr("fill-opacity", 0.7)
                            .attr("x", -(axisBarWidth / 2))
                            .attr("width", axisBarWidth)
                            // .attr("y", currentY)
                            .attr("y", y[dim.name](key))
                            .attr("rx", 2)
                            .attr("ry", 2)
                            // .attr("height", grpHeight);
                            .attr("height", y[dim.name].bandwidth())
                            .on("click", function(d) {
                                console.log(dim);
                            })
                            .append('title')
                                .text(`${key}, n = ${grp.length} / ${tuples.length}`);

                        // grp.center = currentY + (grpHeight / 2);
                        // currentY = currentY + grpHeight;
                    })
                }
            })
            .append("text")
                .attr("class", "dimensionLabel")
                .attr("id", function(d) { return d.name; })
                .style("text-anchor", "middle")
                .attr("fill", "#000")
                .style("font-weight", "bold")
                .style("font-family", "sans-serif")
                .style("font-size", 11)
                .attr("y", -9)
            .text(d => d.name);
        
        // Add and store a brush for each axis.
        g.append("g")
            .attr("class", "brush")
            .each(function (d) {
                d3.select(this).call(y[d.name].brush = d3.brushY()
                    .extent([
                        [-10, 0],
                        [10, pcpHeight]
                    ])
                    // .on("brush", brush)
                    .on("end", brush)
                );
            })
            .selectAll("rect")
            .attr("x", -8)
            .attr("width", 16);
        
    }

    // Handles a brush event, toggling the display of foreground lines.
    function brush() {
        let actives = [];
        svg.selectAll(".brush")
            .filter(function (dim) {
                y[dim.name].brushSelectionValue = d3.brushSelection(this);
                return d3.brushSelection(this);
            })
            .each(function (dim) {
                // Get extents of brush along each active selection axis (the Y axes)
                // actives.push({
                //     dimension: dim,
                //     extent: d3.brushSelection(this).map(y[dim.name].invert)
                // });
                if (dim.type === 'categorical') {
                    let selected = y[dim.name].domain().filter(value => {
                        const pos = y[dim.name](value) + y[dim.name].bandwidth() / 2;
                        return pos > d3.brushSelection(this)[0] && pos < d3.brushSelection(this)[1];
                    });
                    actives.push({
                        dimension: dim,
                        extent: selected
                    });
                } else {
                    actives.push({
                        dimension: dim,
                        extent: d3.brushSelection(this).map(y[dim.name].invert)
                    });
                }
            });

        // selected = [];
        // unselected = [];
        console.log(actives);
        selectTuples(actives);
        // tuples.map(function (t) {
        //     return actives.every(function (a, i) {
        //         return t[a.dimension.name] <= a.extent[0] && t[a.dimension.name] >= a.extent[1];
        //     }) ? selected.push(t) : unselected.push(t);
        // });

        drawLines();
    }

    function selectTuples(actives) {
        unselected = [];

        if (actives && actives.length > 0) {
            selected = [];
        
            tuples.map(function (t) {
                return actives.every(function (active) {
                    if (active.dimension.type === 'categorical') {
                        return active.extent.indexOf(t[active.dimension.name]) >= 0;
                    } else {
                        return t[active.dimension.name] <= active.extent[0] && t[active.dimension.name] >= active.extent[1];
                    }
                }) ? selected.push(t) : unselected.push(t);
            });
        } else {
            selected = tuples;
        }
    }

    function path(d, ctx) {
        ctx.beginPath();
        dimensions.map(function (dim, i) {
            if (i == 0) {
                if (dim.type === 'categorical') {
                    const jitter = Math.random() * (y[dim.name].bandwidth() / 4) - (y[dim.name].bandwidth() / 8);
                    ctx.moveTo(x(dim.name) - (axisBarWidth / 2), dim.groups.get(d[dim.name]).center + jitter);
                    ctx.moveTo(x(dim.name) + (axisBarWidth / 2), dim.groups.get(d[dim.name]).center + jitter);
                } else {
                    ctx.moveTo(x(dim.name), y[dim.name](d[dim.name]));
                }
            } else {
                if (dim.type === 'categorical') {
                    const jitter = Math.random() * (y[dim.name].bandwidth() / 4) - (y[dim.name].bandwidth() / 8);
                    ctx.lineTo(x(dim.name) - (axisBarWidth / 2), dim.groups.get(d[dim.name]).center + jitter);
                    ctx.lineTo(x(dim.name) + (axisBarWidth / 2), dim.groups.get(d[dim.name]).center + jitter);
                    // ctx.lineTo(x(dim.name), dim.groups.get(d[dim.name]).center);
                } else {
                    ctx.lineTo(x(dim.name), y[dim.name](d[dim.name]));
                }
            }
        });
        ctx.stroke();
    };

    function drawLines() {
        drawBackgroundLines();
        drawForegroundLines();

        const pctSelected = ((selected.length / tuples.length) * 100.).toFixed(1);
        svg.select(".selection_indicator_label")
            .text(`${selected.length} / ${tuples.length} (${pctSelected}%) Lines Selected`);
        const selectionLineWidth = width * (selected.length / tuples.length);
        svg.select(".selection_indicator_line")
            .transition().duration(200).delay(100)
            .attr("x2", selectionLineWidth);
    }

    function drawForegroundLines() {
        // foreground.clearRect(-canvasMargin, -canvasMargin, width + canvasMargin, height + canvasMargin);
        foreground.clearRect(-canvasMargin, -canvasMargin, width + canvasMargin * 2, pcpHeight + canvasMargin * 2);

        if (showSelected) {
            selected.map(function (d) {
                path(d, foreground);
            });
        }
    }

    function drawBackgroundLines() {
        // background.clearRect(-canvasMargin, -canvasMargin, width + canvasMargin, height + canvasMargin);
        background.clearRect(-canvasMargin, -canvasMargin, width + canvasMargin * 2, pcpHeight + canvasMargin * 2);
        if (showUnselected) {
            unselected.map(function (d) {
                path(d, background);
            });
        }
    }

    chart.width = function (value) {
        if (!arguments.length) {
            return width;
        }
        width = value - margin.left - margin.right;
        return chart;
    }

    chart.height = function (value) {
        if (!arguments.length) {
            return height;
        }
        height = value - margin.top - margin.bottom;
        return chart;
    }

    chart.titleText = function (value) {
        if (!arguments.length) {
            return titleText;
        }
        titleText = value;
        return chart;
    }

    chart.showSelectedLines = function (value) {
        if (!arguments.length) {
            return showSelected;
        }
        showSelected = value;
        if (foreground) {
            drawLines();
        }
        return chart;
    }

    chart.showUnselectedLines = function (value) {
        if (!arguments.length) {
            return showUnselected;
        }
        showUnselected = value;
        if (background) {
            drawLines();
        }
        return chart;
    }

    chart.selectedLineOpacity = function (value) {
        if (!arguments.length) {
            return selectedLineOpacity;
        }
        selectedLineOpacity = value;
        if (foreground) {
            foreground.globalAlpha = selectedLineOpacity;
            drawForegroundLines();
        }
        return chart;
    }

    chart.unselectedLineOpacity = function (value) {
        if (!arguments.length) {
            return unselectedLineOpacity;
        }
        unselectedLineOpacity = value;
        if (background) {
            background.globalAlpha = unselectedLineOpacity;
            drawBackgroundLines();
        }
        return chart;
    }

    chart.margin = function (value) {
        if (!arguments.length) {
            return margin;
        }
        oldChartWidth = width + margin.left + margin.right
        oldChartHeight = height + margin.top + margin.bottom
        margin = value;
        width = oldChartWidth - margin.left - margin.right
        height = oldChartHeight - margin.top - margin.bottom
        return chart;
    }

    chart.orientation = function (value) {
        if (!arguments.length) {
            return orientation;
        }
        orientation = value;
        return chart;
    }

    return chart;
}