var pcpChart = function () {
  let margin = {
    top: 20,
    right: 10,
    bottom: 20,
    left: 10,
  };
  let width = 800 - margin.left - margin.right;
  let height = 300 - margin.top - margin.bottom;
  let titleText = "";
  let selectedLineOpacity = 0.15;
  let unselectedLineOpacity = 0.05;
  let selectedLineColor = "steelblue";
  let unselectedLineColor = "#CCC";
  let showSelected = true;
  let showUnselected = true;
  let showAxisTicks = true;
  let showAxisTickLabels = true;
  let showHistograms = false;

  let tuples;
  let tupleLines;
  let selectedDimension;
  let svg;
  let foreground;
  let background;
  let selected;
  let unselected;
  let dimensions;
  let x;
  let y = {};
  let dimensionHeaderSize = 40;
  let canvasMargin = 6;
  let axisBarWidth = 24;
  let selectionIndicatorHeight = 40;
  let pcpHeight;
  let correlationRectPadding = 8;
  let correlationRectSize = 20;
  let correlationLabelHeight = 12;
  let correlationColorScale = d3.scaleSequential(d3.interpolateRdBu).domain([-1, 1]);
  let highlightColor = "gold";
  let dimensionSelectionChangeHandler = null;

  function chart(selection, data) {
    tuples = data.tuples.slice();
    dimensions = data.dimensions.slice();

    pcpHeight = height - selectionIndicatorHeight - correlationRectPadding - correlationRectSize - dimensionHeaderSize;

    selection.selectAll('*').remove();

    const backgroundCanvas = selection
      .append("canvas")
      .attr("id", "background")
      .attr("width", width + canvasMargin * 2)
      .attr("height", pcpHeight + canvasMargin * 2)
      .style("position", "absolute")
      .style("top", `${margin.top + dimensionHeaderSize - canvasMargin}px`)
      .style("left", `${margin.left - canvasMargin}px`);
    background = backgroundCanvas.node().getContext("2d");
    background.strokeStyle = unselectedLineColor;
    background.globalAlpha = unselectedLineOpacity;
    background.antialias = false;
    background.lineWidth = 1;
    background.translate(canvasMargin + 0.5, canvasMargin + 0.5);

    const foregroundCanvas = selection
      .append("canvas")
      .attr("id", "foreground")
      .attr("width", width + canvasMargin * 2)
      .attr("height", pcpHeight + canvasMargin * 2)
      .style("position", "absolute")
      .style("top", `${margin.top + dimensionHeaderSize - canvasMargin}px`)
      .style("left", `${margin.left - canvasMargin}px`);
    foreground = foregroundCanvas.node().getContext("2d");
    foreground.strokeStyle = selectedLineColor;
    foreground.globalAlpha = selectedLineOpacity;
    foreground.antialias = true;
    foreground.lineWidth = 1.5;
    foreground.translate(canvasMargin + 0.5, canvasMargin + 0.5);

    svg = selection
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .style("position", "absolute")
      .append("svg:g")
      .attr("transform", `translate(${margin.left},${margin.top + dimensionHeaderSize})`);

    svg.append("text")
      .attr("x", width / 2)
      .attr("y", -30)
      .style("text-anchor", "middle")
      .style("font-weight", "bold")
      .style("font-size", "12")
      .text(titleText);

    x = d3.scalePoint().range([0, width]).padding(0.25);

    let dimensionNames = [];
    dimensions.map((dim, i) => {
      dimensionNames.push(dim.name);
      dim.id = i;
      if (dim.type === "numerical") {
        y[dim.name] = d3
          .scaleLinear()
          .domain(d3.extent(tuples, (d) => d[dim.name]))
          .nice();
      } else if (dim.type === "categorical") {
        const domain = [...new Set(tuples.map((d) => d[dim.name]))].sort(
          d3.descending
        );
        y[dim.name] = d3.scaleBand().domain(domain).paddingInner(0.0);
      } else if (dim.type === "temporal") {
        y[dim.name] = d3
          .scaleTime()
          .domain(d3.extent(tuples, (d) => d[dim.name]))
          .nice();
      }

      if (y[dim.name]) {
        y[dim.name].range([pcpHeight, 0]);
      }

      if (dim.type === "categorical") {
        dim.categories = Array.from(d3.group(tuples, (d) => d[dim.name]), ([key,value],i) => ({name: key, id: i, values: value}));
        dim.categories.sort((a,b) => d3.descending(a.values.length, b.values.length));
        dim.selectedCategories = new Set();
      } else {
        let values = tuples.map(d => d[dim.name])
          .filter(d => d !== null && !isNaN(d))
          .sort(d3.ascending);
        dim.count = values.length;
        dim.bins = d3.bin().value((d) => d[dim.name])(tuples);
        if (dim.type === "numerical") {
          dim.stats = {
            mean: d3.mean(values),
            median: d3.median(values),
            count: d3.count(values),
            extent: d3.extent(values),
            stdev: d3.deviation(values),
            q1: d3.quantileSorted(values, 0.25),
            q3: d3.quantileSorted(values, 0.75)
          }
        }
      }
    });
    x.domain(dimensionNames);

    // svg.append("rect")
    //     .attr("y", pcpHeight)
    //     .attr("height", selectionIndicatorHeight)
    //     .attr("width", width)
    //     .style("stroke", "#000")
    //     .style("fill", "none");

    svg.append("text")
      .attr("class", "selection_indicator_label")
      .attr("x", width - 2)
      .attr("y", pcpHeight + 14 + correlationRectPadding + correlationRectSize + selectionIndicatorHeight / 2)
      .attr("text-anchor", "end")
      .style("font-size", "12")
      .style("font-family", "sans-serif")
      .text(`0 / ${tuples.length} (0.0%) Tuples Selected`);

    svg.append("line")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", pcpHeight + correlationRectPadding + correlationRectSize + selectionIndicatorHeight / 2)
      .attr("y2", pcpHeight + correlationRectPadding + correlationRectSize + selectionIndicatorHeight / 2)
      .style("stroke", unselectedLineColor)
      .style("stroke-width", "2")
      .style("stroke-linecap", "round");

    svg.append("line")
      .attr("class", "selection_indicator_line")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", pcpHeight + correlationRectPadding + correlationRectSize + selectionIndicatorHeight / 2)
      .attr("y2", pcpHeight + correlationRectPadding + correlationRectSize + selectionIndicatorHeight / 2)
      .style("stroke", selectedLineColor)
      .style("stroke-width", "4")
      .style("stroke-linecap", "round");

    // Add a group element for each dimension.
    const g = svg.selectAll(".dimension")
      .data(dimensions)
      .enter()
      .append("g")
      .attr("class", "dimension")
      .attr("id", d => `dim_${d.id}`)
      .attr("transform", function (d) {
        return `translate(${x(d.name)})`;
      });
    
    calculateDimensionCorrelations();
    drawDimensions();
    drawHistogramBins();
    computeTupleLines();
    selectTuples();
    drawLines();
  }

  const drag = d3.drag()
    .on("drag", function (d) {
      draggingDimensionName = d3.select(this).attr("id");
      d3.select(this).raise().attr("x", d3.event.x);
    })
    .on("end", function (d) {
      draggingDimensionName = d3.select(this).attr("id");
      let srcIdx = dimensions.findIndex(
        (d) => d.name === draggingDimensionName
      );
      let dstIdx =
        d3.event.x > 0
          ? Math.floor(d3.event.x / x.step())
          : Math.ceil(d3.event.x / x.step());

      d3.select(this).attr("x", 0);
      if (dstIdx != 0) {
        const moveDimension = dimensions[srcIdx];
        dimensions.splice(srcIdx, 1);
        dimensions.splice(srcIdx + dstIdx, 0, moveDimension);

        tupleLines.forEach((yCoordinates, tuple) => {
          const moveValue = yCoordinates[srcIdx];
          yCoordinates.splice(srcIdx, 1);
          yCoordinates.splice(srcIdx + dstIdx, 0, moveValue);
        });

        const dimensionNames = dimensions.map((d) => d.name);
        x.domain(dimensionNames);
        svg.selectAll(".dimension").each(function (dim) {
          d3.select(this).attr("transform", function (d) {
            return `translate(${x(d.name)})`;
          });
        });

        drawLines();
      }
    });

  function drawHistogramBins() {
    svg.selectAll(".dimension")
      .append("g")
      .attr("class", "histogramBin")
      .attr('display', showHistograms ? null : 'none')
      .attr("fill", "lightgray")
      .attr("fill-opacity", 0.5)
      .attr("stroke", "gray")
      .each(function (dim) {
        if (dim.type !== 'categorical') {
          const histogramScale = d3
            .scaleLinear()
            .range([0, x.step() * x.padding()])
            .domain([0, d3.max(dim.bins, (d) => d.length)]);
          d3.select(this)
            // .append("g")
            // .attr("fill", "lightgray")
            // .attr("fill-opacity", 0.3)
            // .attr("stroke", "gray")
            .selectAll("rect")
            .data(dim.bins)
            .join("rect")
              .attr("x", axisBarWidth / 2)
              .attr("width", d => histogramScale(d.length))
              .attr("y", d => y[dim.name](d.x1))
              .attr("height", d => y[dim.name](d.x0) - y[dim.name](d.x1))
              .append("title")
                .text((d) => `[${d.x0}, ${d.x1}]\nCount: ${d.length}`);
        }
      });
  }

  function drawDimensions() {
    const g = svg.selectAll(".dimension");

    g.append("g")
      .attr("class", "dimension_stats")
      .each(function(dim) {
        if (dim.type === "numerical") {
          d3.select(this)
            .append("rect")
              .attr('x', -axisBarWidth / 2)
              .attr('width', axisBarWidth)
              .attr('height', pcpHeight)
              .attr('rx', 3)
              .attr('ry', 3)
              .attr('stroke', 'gray')
              .attr('fill', 'whitesmoke');
          d3.select(this)
            .append("rect")
              .attr("x", -axisBarWidth / 2)
              .attr("width", axisBarWidth)
              .attr("y", y[dim.name](dim.stats.q3))
              .attr("height", y[dim.name](dim.stats.q1) - y[dim.name](dim.stats.q3))
              .attr("stroke", "gray")
              .attr("stroke-width", 1)
              .attr('fill', 'lightgray');
          d3.select(this)
            .append("line")
              .attr("x1", -axisBarWidth / 2)
              .attr("x2", axisBarWidth / 2)
              .attr("y1", y[dim.name](dim.stats.median))
              .attr("y2", y[dim.name](dim.stats.median))
              .attr("stroke", "#00008B")
              .attr("stroke-width", 2);
          
          d3.select(this).append("rect")
            .attr('class', 'correlationRect')
            .attr('x', -(correlationRectSize / 2.))
            .attr('y', y[dim.name].range()[0] + correlationRectPadding)
            .attr('width', correlationRectSize)
            .attr('height', correlationRectSize)
            .attr('rx', 2)
            .attr('ry', 2)
            .attr('fill', 'ghostwhite')
            .attr('stroke', 'gray');

          d3.select(this).append('text')
            .attr('class', 'correlationLabel')
            .style('text-anchor', 'middle')
            .style('font-size', 10)
            .style('font-family', 'sans-serif')
            .attr('y', y[dim.name].range()[0] + correlationRectPadding + correlationRectSize + correlationLabelHeight)
            .text("r");
        } else if (dim.type === "temporal") {
          d3.select(this)
            .append("rect")
              .attr('x', -axisBarWidth / 2)
              .attr('width', axisBarWidth)
              .attr('height', pcpHeight)
              .attr('rx', 3)
              .attr('ry', 3)
              .attr('stroke', 'gray')
              .attr('fill', 'whitesmoke');
        } else if (dim.type === "categorical") {
          let grpHeight = y[dim.name].bandwidth();
          dim.categories.map((cat,i) => {
            i === 0 ? cat.y = 0 : cat.y = dim.categories[i-1].y + dim.categories[i-1].height;
            cat.height = (cat.values.length / tuples.length) * pcpHeight;
            cat.center = cat.y + (cat.height / 2);
          });

          // d3.select(this).append("line")
          //   .attr("x1", 0)
          //   .attr("y1", -4)
          //   .attr("x2", 0)
          //   .attr("y2", pcpHeight + 4)
          //   .attr("stroke", "#AAA")
          //   .attr("stroke-width", 3)
          //   .attr("stroke-linecap", "round");

          d3.select(this).append("g")
            .attr("fill", "#DDD")
            .attr("stroke", "gray")
            .attr("stroke-width", .7)
            .selectAll("rect")
              .data(dim.categories)
              .join("rect")
              .attr("class", "category_rect")
              .attr("id", cat => `cat_${cat.id}`)
              .attr("x", -axisBarWidth / 2)
              .attr("y", cat => cat.y)
              .attr("rx", 3)
              .attr("ry", 3)
              .attr("width", axisBarWidth)
              .attr("height", cat => cat.height)
              .on("click", function(cat) {
                if (dim.selectedCategories.has(cat.id)) {
                  dim.selectedCategories.delete(cat.id);
                  d3.select(this)
                    .attr("stroke", null)
                    .attr("stroke-width", null)
                    .attr("fill", null)
                    .attr("fill-opacity", null);
                } else {
                  dim.selectedCategories.add(cat.id);
                  d3.select(this)
                    .raise()
                    .attr("fill", highlightColor)
                    .attr("fill-opacity", 0.3)
                    .attr("stroke", '#000')
                    .attr("stroke-width", 1.2);
                }
                brush();
                if (dimensionSelectionChangeHandler) {
                  dimensionSelectionChangeHandler(dim.name, [...dim.selectedCategories].map(d => dim.categories.find(cat => cat.id === d).name));
                }
              })
              .on("mouseover", function (d) {
                d3.select(this).style("cursor", "pointer");
              })
              .on("mouseout", function (d) {
                d3.select(this).style("cursor", "default");
              })
              .append("title")
                .text(c => `${c.name}: ${c.values.length} tuples`);

          // d3.select(this).append("g")
          //   .selectAll("text")
          //   .data(dim.categories.filter(c => c.height > 14))
          //   // .data(dim.categories)
          //   .join("text")
          //     .attr("class", "categoryRectLabel")
          //     // .attr("fill", "#000")
          //     .attr('fill', '#000')
          //     .style('text-shadow', '0 1px 0 #fff, 1px 0 0 #fff, 0 -1px 0 #fff, -1px 0 0 #fff')
          //     .attr("y", c => c.center)
          //     .attr("text-anchor", "middle")
          //     .attr("font-size", 10)
          //     .attr("pointer-events", "none")
          //     .text(c => c.name);
        }
      });
    //   .append("text")
    //     .attr("class", "dimensionLabel")
    //     .attr("id", d => `${d.name}`)
    //     .style("text-anchor", "middle")
    //     .attr("fill", "#646464")
    //     .style("font-weight", "bold")
    //     .style("font-family", "sans-serif")
    //     .style("font-size", 11)
    //     .attr("y", -9)
    //     .text((d) => d.name)
    //     .call(drag)
    //     .on('click', function(d) {
    //       if (d3.event.defaultPrevented) return;

    //       if (selectedDimension === d) {
    //         d3.select(this)
    //           .style("fill", '#646464');
    //           // .style('font-size', 10);
    //         selectedDimension = null;
    //       } else {
    //         if (selectedDimension != null) {
    //           d3.select(`#${selectedDimension.name}`)
    //             .style('fill', '#646464');
    //             // .style('font-size', 10);
    //         }
    //         selectedDimension = d;
    //         d3.select(this)
    //           .style('fill', '#000')
    //           // .style('font-size', 12)
    //           .raise();
    //       }
    //       updateCorrelationGraphics();
    //     })
    //     .on("mouseover", function (d) {
    //       d3.select(this).style("cursor", "pointer");
    //     })
    //     .on("mouseout", function (d) {
    //       d3.select(this).style("cursor", "default");
    //     });

    // Add dimension label and close button
    g.append("g")
      .each(function(dim) {
        d3.select(this)
          .append("text")
            .attr("class", "dimensionLabel")
            .attr("id", d => `${d.name}`)
            .style("text-anchor", "middle")
            .attr("fill", "#646464")
            .style("font-weight", "bold")
            .style("font-family", "sans-serif")
            .style("font-size", 11)
            .attr("y", -9)
            .text((d) => d.name)
            .call(drag)
            .on('click', function(d) {
              if (d3.event.defaultPrevented) return;
    
              if (selectedDimension === d) {
                d3.select(this)
                  .style("fill", '#646464');
                  // .style('font-size', 10);
                selectedDimension = null;
              } else {
                if (selectedDimension != null) {
                  d3.select(`#${selectedDimension.name}`)
                    .style('fill', '#646464');
                    // .style('font-size', 10);
                }
                selectedDimension = d;
                d3.select(this)
                  .style('fill', '#000')
                  // .style('font-size', 12)
                  .raise();
              }
              updateCorrelationGraphics();
            })
            .on("mouseover", function (d) {
              d3.select(this).style("cursor", "pointer");
            })
            .on("mouseout", function (d) {
              d3.select(this).style("cursor", "default");
            })
            .append("title")
              .text(d => `${d.name} column\n(click to select or drag to reposition)`);

        d3.select(this)
          .append("rect")
            .attr("x", -5)
            .attr("y", -30)
            .attr('rx', 2)
            .attr('ry', 2)
            .attr("width", 10)
            .attr("height", 10)
            .attr("fill", "ghostwhite")
            .attr("stroke", "none")
            .on('click', function(d) {
              d3.select(`#dim_${dim.id}`).remove();
              dimensions.splice(dimensions.findIndex(dd => dd.id === d.id), 1);
              const dimensionNames = dimensions.map((d) => d.name);
              x.domain(dimensionNames);
              svg.selectAll(".dimension").each(function (dim) {
                d3.select(this).attr("transform", function (d) {
                  return `translate(${x(d.name)})`;
                });
              });
              calculateDimensionCorrelations();
              computeTupleLines();
              brush();
            })
            .on('mouseover', function(d) {
              d3.select(this).style('cursor', 'pointer');
            })
            .on('mouseout', function(d) {
              d3.select(this).style('cursor', 'default');
            })
            .append("title")
              .text(d => `Click to hide ${d.name} column`);

        d3.select(this)
          .append("line")
            .attr("x1", -4)
            .attr("y1", -29)
            .attr("x2", 4)
            .attr("y2", -21)
            .attr("stroke", "#646464")
            .attr("stroke-width", 2)
            .attr("pointer-events", "none");
            
        d3.select(this)
          .append("line")
            .attr("x1", -4)
            .attr("y1", -21)
            .attr("x2", 4)
            .attr("y2", -29)
            .attr("stroke", "#646464")
            .attr("stroke-width", 2)
            .attr("pointer-events", "none");
      });

    // Add an axis.
    const axis = d3.axisLeft();
    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${-axisBarWidth/2},0)`)
      .each(function (dim) {
        if (dim.type === "numerical" || dim.type === "temporal") {
          d3.select(this)
            .call(axis.scale(y[dim.name])
              .ticks(pcpHeight / 24)
              .tickSize(-axisBarWidth))
            .call(g => g.selectAll(".tick:first-of-type line").remove())
            .call(g => g.selectAll(".tick:last-of-type line").remove())
            .call(g => g.selectAll(".tick line")
              // .attr("stroke", "#646464")
              .attr("stroke-opacity", 0.5)
              .attr("stroke-dasharray", "2,2")
              .attr("display", showAxisTicks ? null : "none"))
            .call(g => g.select(".domain").remove())
            .call(g => g.selectAll(".axis text")
              // .attr("dx", -axisBarWidth)
              .attr("fill", "#646464")
              .attr("display", showAxisTickLabels ? null : "none")
              .style('text-shadow', '0 1px 0 #fff, 1px 0 0 #fff, 0 -1px 0 #fff, -1px 0 0 #fff'));
          // d3.select(this).selectAll('.axis text')
          //   .attr('fill', '#646464')
          //   .style('text-shadow', '0 1px 0 #fff, 1px 0 0 #fff, 0 -1px 0 #fff, -1px 0 0 #fff');
        } else if (dim.type === 'categorical') {
          d3.select(this).append("g")
            .selectAll("text")
            .data(dim.categories.filter(c => c.height > 14))
            // .data(dim.categories)
            .join("text")
              .attr("class", "categoryRectLabel")
              // .attr("fill", "#000")
              .attr('fill', '#000')
              .style('text-shadow', '0 1px 0 #fff, 1px 0 0 #fff, 0 -1px 0 #fff, -1px 0 0 #fff')
              .attr("y", c => c.center)
              .attr("dx", -2)
              .attr("text-anchor", "end")
              .attr("font-size", 10)
              .attr("pointer-events", "none")
              .text(c => c.name);
        }
      });
    /*
    g.append("g")
      .attr("class", "axis")
      .each(function (dim) {
        if (dim.type === "numerical" || dim.type === "temporal") {
          if (dim.type === "numerical") {
            d3.select(this)
              .append("rect")
                .attr('x', -axisBarWidth / 2)
                .attr('width', axisBarWidth)
                .attr('height', pcpHeight)
                .attr('rx', 3)
                .attr('ry', 3)
                .attr('stroke', 'gray')
                .attr('fill', 'whitesmoke');
            d3.select(this)
              .append("rect")
                .attr("x", -axisBarWidth / 2)
                .attr("width", axisBarWidth)
                .attr("y", y[dim.name](dim.stats.q3))
                .attr("height", y[dim.name](dim.stats.q1) - y[dim.name](dim.stats.q3))
                .attr("stroke", "gray")
                .attr("stroke-width", 1)
                .attr('fill', 'lightgray');
            d3.select(this)
              .append("line")
                .attr("x1", -axisBarWidth / 2)
                .attr("x2", axisBarWidth / 2)
                .attr("y1", y[dim.name](dim.stats.median))
                .attr("y2", y[dim.name](dim.stats.median))
                .attr("stroke", "#00008B")
                .attr("stroke-width", 2);
          }

          d3.select(this).append("rect")
            .attr('class', 'correlationRect')
            .attr('x', -(correlationRectSize / 2.))
            .attr('y', y[dim.name].range()[0] + correlationRectPadding)
            .attr('width', correlationRectSize)
            .attr('height', correlationRectSize)
            .attr('rx', 2)
            .attr('ry', 2)
            .attr('fill', 'ghostwhite')
            .attr('stroke', 'gray');

          d3.select(this).append('text')
            .attr('class', 'correlationLabel')
            .style('text-anchor', 'middle')
            .style('font-size', 10)
            .style('font-family', 'sans-serif')
            .attr('y', y[dim.name].range()[0] + correlationRectPadding + correlationRectSize + correlationLabelHeight)
            .text("r");

          d3.select(this)
            .call(axis.scale(y[dim.name]).ticks(pcpHeight / 20))
          
          d3.select(this).selectAll('.axis text')
            .attr('fill', '#646464')
            .style('text-shadow', '0 1px 0 #fff, 1px 0 0 #fff, 0 -1px 0 #fff, -1px 0 0 #fff');
            

        } else {
          let grpHeight = y[dim.name].bandwidth();
          dim.categories.map((cat,i) => {
            i === 0 ? cat.y = 0 : cat.y = dim.categories[i-1].y + dim.categories[i-1].height;
            cat.height = (cat.values.length / tuples.length) * pcpHeight;
            cat.center = cat.y + (cat.height / 2);
          });

          // d3.select(this).append("line")
          //   .attr("x1", 0)
          //   .attr("y1", -4)
          //   .attr("x2", 0)
          //   .attr("y2", pcpHeight + 4)
          //   .attr("stroke", "#AAA")
          //   .attr("stroke-width", 3)
          //   .attr("stroke-linecap", "round");

          d3.select(this).append("g")
            .attr("fill", "#DDD")
            .attr("stroke", "gray")
            .attr("stroke-width", .7)
            .selectAll("rect")
              .data(dim.categories)
              .join("rect")
              .attr("class", "category_rect")
              .attr("id", cat => `cat_${cat.id}`)
              .attr("x", -axisBarWidth / 2)
              .attr("y", cat => cat.y)
              .attr("rx", 3)
              .attr("ry", 3)
              .attr("width", axisBarWidth)
              .attr("height", cat => cat.height)
              .on("click", function(cat) {
                console.log(`${cat.name} of ${dim.name} clicked`);
                console.log(dim.selectedCategories);
                if (dim.selectedCategories.has(cat.id)) {
                  dim.selectedCategories.delete(cat.id);
                  // console.log(dim.selectedCategories);
                  d3.select(this)
                    .attr("stroke", null)
                    .attr("stroke-width", null)
                    .attr("fill", null)
                    .attr("fill-opacity", null);
                } else {
                  dim.selectedCategories.add(cat.id);
                  // console.log(dim.selectedCategories);
                  d3.select(this)
                    .raise()
                    .attr("fill", highlightColor)
                    .attr("fill-opacity", 0.3)
                    .attr("stroke", '#000')
                    .attr("stroke-width", 1.2);
                }
                console.log(dim.selectedCategories);
                brush();
                if (dimensionSelectionChangeHandler) {
                  dimensionSelectionChangeHandler(dim.name, [...dim.selectedCategories].map(d => dim.categories.find(cat => cat.id === d).name));
                }
              })
              .on("mouseover", function (d) {
                d3.select(this).style("cursor", "pointer");
              })
              .on("mouseout", function (d) {
                d3.select(this).style("cursor", "default");
              })
              .append("title")
                .text(c => `${c.name}: ${c.values.length} tuples`);

          d3.select(this).append("g")
            .selectAll("text")
            .data(dim.categories.filter(c => c.height > 14))
            // .data(dim.categories)
            .join("text")
              .attr("class", "categoryRectLabel")
              // .attr("fill", "#000")
              .attr('fill', '#000')
              .style('text-shadow', '0 1px 0 #fff, 1px 0 0 #fff, 0 -1px 0 #fff, -1px 0 0 #fff')
              .attr("y", c => c.center)
              .attr("text-anchor", "middle")
              .attr("font-size", 10)
              .attr("pointer-events", "none")
              .text(c => c.name);
        }
      })
      .append("text")
      .attr("class", "dimensionLabel")
      .attr("id", d => `${d.name}`)
      .style("text-anchor", "middle")
      .attr("fill", "#646464")
      .style("font-weight", "bold")
      .style("font-family", "sans-serif")
      .style("font-size", 11)
      .attr("y", -9)
      .text((d) => d.name)
      .call(drag)
      .on('click', function(d) {
        if (d3.event.defaultPrevented) return;

        if (selectedDimension === d) {
          d3.select(this)
            .style("fill", '#646464');
            // .style('font-size', 10);
          selectedDimension = null;
        } else {
          if (selectedDimension != null) {
            d3.select(`#${selectedDimension.name}`)
              .style('fill', '#646464');
              // .style('font-size', 10);
          }
          selectedDimension = d;
          d3.select(this)
            .style('fill', '#000')
            // .style('font-size', 12)
            .raise();
        }
        updateCorrelationGraphics();
      })
      .on("mouseover", function (d) {
        d3.select(this).style("cursor", "pointer");
      })
      .on("mouseout", function (d) {
        d3.select(this).style("cursor", "default");
      });
*/
    // Add and store a brush for each axis.
    g.append("g")
      .attr("class", "brush")
      .each(function (dim) {
        if (dim.type !== 'categorical') {
          d3.select(this).call(
            (y[dim.name].brush = d3
              .brushY()
              .extent([
                [-axisBarWidth/2, 0],
                [axisBarWidth/2, pcpHeight],
              ])
              // .on("brush", brush)
              .on("end", brush))
          );
        }
      })
      .selectAll("rect")
        .attr("x", -8)
        .attr("width", 16);
    
    g.selectAll(".brush rect.selection")
      .attr("stroke", "#000")
      .attr("fill", highlightColor)
      .attr('fill-opacity', .3);
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
        if (dim.type === "categorical") {
          let selected = dim.categories.filter(cat => {
            return (
              (cat.y <= d3.brushSelection(this)[0] &&
              cat.y + cat.height > d3.brushSelection(this)[0]) ||
              (cat.y <= d3.brushSelection(this)[1] &&
              cat.y + cat.height > d3.brushSelection(this)[1])
            );
          });
          // let selected = y[dim.name].domain().filter((value) => {
          //   const pos = y[dim.name](value) + y[dim.name].bandwidth() / 2;
          //   return (
          //     pos > d3.brushSelection(this)[0] &&
          //     pos < d3.brushSelection(this)[1]
          //   );
          // });
          actives.push({
            dimension: dim,
            extent: selected.map(d => d.id),
          });
        } else {
          actives.push({
            dimension: dim,
            extent: d3.brushSelection(this).map(y[dim.name].invert),
          });
        }
      });
    
    dimensions.forEach(dim => {
      if (dim.type === 'categorical') {
        if (dim.selectedCategories.size > 0) {
          console.log(dim);
          actives.push({
            dimension: dim,
            extent: [...dim.selectedCategories].map(d => dim.categories.find(cat => cat.id === d).name)
            // extent: [...dim.selectedCategories]
          });
        }
      }
    })

    selectTuples(actives);
    drawLines();
  }

  function updateCorrelationGraphics() {
    svg.selectAll('.dimension')
      .each(function(dim) {
        if (selectedDimension && dim.correlationMap) {
          if (dim === selectedDimension) {
            d3.select(this).select('.correlationRect')
              .attr('display', 'none');
            d3.select(this).select('.correlationLabel')
              .attr('display', 'none');
          } else {
            const r = dim.correlationMap.get(selectedDimension.name);
            if (r) {
              d3.select(this).select('.correlationRect')
                .attr('display', null)
                .attr('fill', correlationColorScale(r));
              d3.select(this).select('.correlationLabel')
                .attr('display', null)
                .text(r.toFixed(2));
            } else {
              d3.select(this).select('.correlationRect')
                .attr('display', 'none');
              d3.select(this).select('.correlationLabel')
                .attr('display', 'none');
            }
          }
        } else {
          d3.select(this).select('.correlationRect')
            .attr('display', 'none');
          d3.select(this).select('.correlationLabel')
            .attr('display', 'none');
        }
      });
  }

  function calculateDimensionCorrelations() {
    const data = (selected && selected.length > 0) ? selected : tuples;
    dimensions.forEach(dim1 => {
      if (dim1.type === 'numerical') {
        dim1.correlationMap = new Map();
        d1 = data.map(d => d[dim1.name]);
        dimensions.forEach(dim2 => {
          if (dim2.type === 'numerical') {
            d2 = data.map(d => d[dim2.name]);
            let d1_filtered = [], d2_filtered = [];
            for (let i = 0; i < d1.length; i++) {
              if (!isNaN(d1[i]) && !isNaN(d2[i])) {
                d1_filtered.push(d1[i]);
                d2_filtered.push(d2[i]);
              }
            }
            r = corr(d1_filtered, d2_filtered);
            // console.log(`${dim1.name}:${dim2.name} = ${r}`);
            dim1.correlationMap.set(dim2.name, r);
          }
        });
      }
    });
  }

  function corr(d1, d2) {
    let { min, pow, sqrt } = Math;
    let add = (a,b) => a + b;
    let n = min(d1.length, d2.length);
    if (n === 0) {
        return 0;
    }
    [d1, d2] = [d1.slice(0,n), d2.slice(0,n)];
    let [sum1, sum2] = [d1, d2].map(l => l.reduce(add));
    let [pow1, pow2] = [d1, d2].map(l => l.reduce((a,b) => a + pow(b, 2), 0));
    let mulSum = d1.map((n, i) => n * d2[i]).reduce(add);
    let dense = sqrt((pow1 - pow(sum1, 2) / n) * (pow2 - pow(sum2, 2) / n));
    if (dense === 0) {
        return 0
    }
    return (mulSum - (sum1 * sum2 / n)) / dense;
  }

  function selectTuples(actives) {
    unselected = [];

    if (actives && actives.length > 0) {
      selected = [];

      tuples.map(function (t) {
        return actives.every(function (active) {
          if (active.dimension.type === "categorical") {
            return active.extent.indexOf(t[active.dimension.name]) >= 0;
          } else {
            return (
              t[active.dimension.name] <= active.extent[0] &&
              t[active.dimension.name] >= active.extent[1]
            );
          }
        })
          ? selected.push(t)
          : unselected.push(t);
      });
    } else {
      selected = tuples;
    }
    // console.log(selected);
    calculateDimensionCorrelations();
    updateCorrelationGraphics();
  }

  function computeTupleLines() {
    tupleLines = new Map();
    tuples.map(t => {
      let yCoordinates = dimensions.map((dim, i) => {
        if (dim.type === 'categorical') {
          const cat = dim.categories.find(cat => cat.name === t[dim.name]);
          const jitter = Math.random() * (cat.height / 4) - (cat.height / 8);
          const yPos = cat.center + jitter;
          return yPos;
        } else {
          return (isNaN(t[dim.name]) || t[dim.name] === null) ? NaN : y[dim.name](t[dim.name]);
        }
      });
      tupleLines.set(t, yCoordinates);
    });
    // console.log(tupleLines);
  }

  function path(tuple, ctx) {
    let yCoordinates = tupleLines.get(tuple);
    // console.log(tuple);
    // console.log(yCoordinates);
    dimensions.map(function (dim, i) {
      if (i < dimensions.length - 1) {
        const nextDim = dimensions[i + 1];
        if (!isNaN(yCoordinates[i]) && !isNaN(yCoordinates[i+1])) {
          ctx.beginPath();
          ctx.moveTo(x(dim.name) + axisBarWidth / 2, yCoordinates[i]);
          ctx.lineTo(x(nextDim.name) - axisBarWidth / 2, yCoordinates[i + 1]);
          ctx.stroke();
          // if (dim.type === 'categorical') {
          //   ctx.beginPath();
          //   ctx.moveTo(x(dim.name) + axisBarWidth / 2, yCoordinates[i]);
          //   if (nextDim.type === 'categorical') {
          //     ctx.lineTo(x(nextDim.name) - axisBarWidth / 2, yCoordinates[i + 1]);
          //   } else {
          //     ctx.lineTo(x(nextDim.name), yCoordinates[i + 1]);
          //   }
          //   ctx.stroke();
          // } else {
          //   ctx.beginPath();
          //   ctx.moveTo(x(dim.name), yCoordinates[i]);
          //   if (nextDim.type === 'categorical') {
          //     ctx.lineTo(x(nextDim.name) - axisBarWidth / 2, yCoordinates[i + 1]);
          //   } else {
          //     ctx.lineTo(x(nextDim.name), yCoordinates[i + 1]);
          //   }
          //   ctx.stroke();
          // }
        }
      }
    });
  }
  // function path(tuple, ctx) {
  //   let yCoordinates = tupleLines.get(tuple);
  //   ctx.beginPath();
  //   dimensions.map(function (dim, i) {
  //     if (dim.type === 'categorical') {
  //       if (i === 0) {
  //         ctx.moveTo(x(dim.name) - axisBarWidth / 2, yCoordinates[i]);
  //         ctx.moveTo(x(dim.name) + axisBarWidth / 2, yCoordinates[i]);
  //       } else {
  //         ctx.lineTo(x(dim.name) - axisBarWidth / 2, yCoordinates[i]);
  //         ctx.lineTo(x(dim.name) + axisBarWidth / 2, yCoordinates[i]);
  //       }
  //     } else {
  //       if (i === 0) {
  //         ctx.moveTo(x(dim.name), yCoordinates[i]);
  //       } else {
  //         ctx.lineTo(x(dim.name), yCoordinates[i]);
  //       }
  //     }
  //   });

    /*
    dimensions.map(function (dim, i) {
      if (i == 0) {
        if (dim.type === "categorical") {
          const cat = dim.categories.find(cat => cat.name === d[dim.name]);
          const jitter = Math.random() * (cat.height / 4) - (cat.height / 8);
          const yPos = cat.center + jitter;
          // const jitter = Math.random() * (y[dim.name].bandwidth() / 4) - y[dim.name].bandwidth() / 8;
          // const yPos = dim.categories.find(cat => cat.name === d[dim.name]).center;
          ctx.moveTo(x(dim.name) - axisBarWidth / 2, yPos);
          ctx.moveTo(x(dim.name) + axisBarWidth / 2, yPos);
          // ctx.moveTo(x(dim.name) - axisBarWidth / 2, dim.groups.get(d[dim.name]).center + jitter);
          // ctx.moveTo(x(dim.name) + axisBarWidth / 2, dim.groups.get(d[dim.name]).center + jitter);
        } else {
          ctx.moveTo(x(dim.name), y[dim.name](d[dim.name]));
        }
      } else {
        if (dim.type === "categorical") {
          const cat = dim.categories.find(cat => cat.name === d[dim.name]);
          const jitter = Math.random() * (cat.height / 4) - (cat.height / 8);
          const yPos = cat.center + jitter;
          // const jitter = Math.random() * (y[dim.name].bandwidth() / 4) - y[dim.name].bandwidth() / 8;
          // const yPos = dim.categories.find(cat => cat.name === d[dim.name]).center;
          ctx.lineTo(x(dim.name) - axisBarWidth / 2, yPos);
          ctx.lineTo(x(dim.name) + axisBarWidth / 2, yPos);
          // ctx.lineTo(x(dim.name) - axisBarWidth / 2, dim.groups.get(d[dim.name]).center + jitter);
          // ctx.lineTo(x(dim.name) + axisBarWidth / 2, dim.groups.get(d[dim.name]).center + jitter);
          // ctx.lineTo(x(dim.name), dim.groups.get(d[dim.name]).center);
        } else {
          ctx.lineTo(x(dim.name), y[dim.name](d[dim.name]));
        }
      }
    });
    */
  //   ctx.stroke();
  // }

  function drawLines() {
    drawBackgroundLines();
    drawForegroundLines();

    const pctSelected = ((selected.length / tuples.length) * 100).toFixed(1);
    svg.select(".selection_indicator_label")
      .text(`${selected.length} / ${tuples.length} (${pctSelected}%) Lines Selected`);
    const selectionLineWidth = width * (selected.length / tuples.length);
    svg.select(".selection_indicator_line")
      .transition()
      .duration(200)
      .delay(100)
      .attr("x2", selectionLineWidth);
  }

  function drawForegroundLines() {
    foreground.clearRect(
      -canvasMargin,
      -canvasMargin,
      width + canvasMargin * 2,
      pcpHeight + canvasMargin * 2
    );

    if (showSelected) {
      selected.map(function (d) {
        path(d, foreground);
      });
    }
  }

  function drawBackgroundLines() {
    background.clearRect(
      -canvasMargin,
      -canvasMargin,
      width + canvasMargin * 2,
      pcpHeight + canvasMargin * 2
    );
    if (showUnselected) {
      unselected.map(function (d) {
        path(d, background);
      });
    }
  }

  chart.setDimensionSelection = function(dimensionName, selection) {
    const dim = dimensions.find(d => d.name === dimensionName);
    if (dim) {
      if (dim.type === 'categorical') {
        var selectedCategories = new Set();
        dim.categories.map(cat => {
          selection.map(s => {
            if (s === cat.name) { selectedCategories.add(cat); }
          });
        });

        dim.selectedCategories.clear();
        selectedCategories.forEach(c => dim.selectedCategories.add(c.id));

        svg.selectAll(`#dim_${dim.id}.dimension`).selectAll('rect')
          .each(function(cat) {
            if (selectedCategories.has(cat)) {
              d3.select(this)
                .attr('fill', highlightColor)
                .attr('fill-opacity', 0.3)
                .attr('stroke', '#000')
                .attr('stroke-width', 1.2);
            } else {
              d3.select(this)
                .attr("stroke", null)
                .attr("stroke-width", null)
                .attr("fill", null)
                .attr("fill-opacity", null);
            }
          });
        brush();
      }
    }
  }

  chart.selectionChangeHandler = function(value) {
    if (!arguments.length) {
      return dimensionSelectionChangeHandler;
    }
    dimensionSelectionChangeHandler = value;
    return chart;
  }

  chart.width = function (value) {
    if (!arguments.length) {
      return width;
    }
    width = value - margin.left - margin.right;
    return chart;
  };

  chart.height = function (value) {
    if (!arguments.length) {
      return height;
    }
    height = value - margin.top - margin.bottom;
    
    return chart;
  };

  chart.titleText = function (value) {
    if (!arguments.length) {
      return titleText;
    }
    titleText = value;
    return chart;
  };

  
  chart.setShowHistograms = function (value) {
    if (!arguments.length) {
      return showHistograms;
    }
    showHistograms = value;
    if (svg) {
      console.log(svg.selectAll("g.histogramBin"));
      svg.selectAll(".histogramBin")
        .attr('display', showHistograms ? null : 'none');
    }
    return chart;
  }

  chart.showAxisTicks = function (value) {
    if (!arguments.length) {
      return showAxisTicks;
    }
    showAxisTicks = value;
    if (svg) {
      svg.selectAll(".tick line")
        .attr("display", showAxisTicks ? null : "none");
    }
    return chart;
  }
  
  chart.showAxisTickLabels = function (value) {
    if (!arguments.length) {
      return showAxisTickLabels;
    }
    showAxisTickLabels = value;
    if (svg) {
      svg.selectAll(".axis text")
        .attr("display", showAxisTickLabels ? null : "none");
    }
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
  };

  chart.showUnselectedLines = function (value) {
    if (!arguments.length) {
      return showUnselected;
    }
    showUnselected = value;
    if (background) {
      drawLines();
    }
    return chart;
  };

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
  };

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
  };

  chart.margin = function (value) {
    if (!arguments.length) {
      return margin;
    }
    oldChartWidth = width + margin.left + margin.right;
    oldChartHeight = height + margin.top + margin.bottom;
    margin = value;
    width = oldChartWidth - margin.left - margin.right;
    height = oldChartHeight - margin.top - margin.bottom;
    return chart;
  };

  chart.orientation = function (value) {
    if (!arguments.length) {
      return orientation;
    }
    orientation = value;
    return chart;
  };

  return chart;
};
